import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { setTestDbClient, DbClient } from '../src/db';
import {
  calculateMKT,
  calculateRemainingShelfLife,
  computeBatchHash,
  generateEd25519KeyPair,
  getUtcTimestamp,
  computeCanonicalHash,
  GENESIS_PREV_HASH,
  ProfileParameters,
} from '@frostledger/shared';
import { DeviceSimulator } from '@frostledger/simulator';
import { processBatchDeterministic } from '../src/services/deterministicCore';

describe('Stage 3: Deterministic Core (MKT, Shelf Life, Thresholds, Alerts)', () => {
  let app: any;
  let pglite: PGlite;
  let testDb: DbClient;
  let operatorToken: string;
  const webhookSecret = 'test_webhook_stage3';
  const deviceId = 'dev-det-001';
  const shipmentId = 'shipment-det-001';
  let deviceKeys: { publicKeyHex: string; privateKeyHex: string };

  const testProfileParams: ProfileParameters = {
    name: 'mRNA Vaccine 2-8 C',
    cargo_type: 'vaccine',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    ref_temp_c: 5.0,
    ref_shelf_life_hours: 720.0,
    activation_energy_j_mol: 83144.72,
    humidity_min_pct: 20.0,
    humidity_max_pct: 60.0,
    max_shock_g: 3.0,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_jwt_secret_deterministic_core_32_chars';
    process.env.WEBHOOK_SECRET = webhookSecret;

    pglite = new PGlite();
    testDb = {
      async query<T = any>(sql: string, params?: any[]) {
        const res = await pglite.query(sql, params);
        return { rows: res.rows as T[], rowCount: res.rows?.length ?? 0 };
      },
      async exec(sql: string) {
        await pglite.exec(sql);
      },
      async close() {
        await pglite.close();
      },
      isPGlite: true,
    };

    setTestDbClient(testDb);
    app = createApp();

    await runMigrations(testDb);

    // Register test device
    deviceKeys = generateEd25519KeyPair();
    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, 'org-det', deviceKeys.publicKeyHex, 'active', getUtcTimestamp()]
    );

    // Register test profile
    await testDb.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['profile-det-v1', 1, JSON.stringify(testProfileParams), 'system-test', getUtcTimestamp()]
    );

    // Register test shipment
    const profileHash = computeCanonicalHash(testProfileParams);
    await testDb.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [shipmentId, deviceId, 'profile-det-v1', 1, profileHash, 'in_transit', getUtcTimestamp()]
    );

    // Register operator user for alert acknowledgement tests
    const userRegRes = await request(app).post('/auth/register').send({
      email: 'operator3@coldchain.test',
      password: 'OperatorPassword123!',
      role: 'operator',
      org_id: 'org-det',
    });
    expect(userRegRes.status).toBe(201);

    const loginRes = await request(app).post('/auth/login').send({
      email: 'operator3@coldchain.test',
      password: 'OperatorPassword123!',
    });
    expect(loginRes.status).toBe(200);
    operatorToken = loginRes.body.token;
  });

  afterAll(async () => {
    await testDb.close();
    setTestDbClient(null);
  });

  // Acceptance Check 1: Hand-calculated MKT with uneven intervals and an offline gap
  it('Acceptance Check 1: Unit tests with hand-calculated MKT examples (including uneven intervals and gap) match exactly', () => {
    /**
     * Hand-calculated theoretical specification:
     * Ea = 83,144.72 J/mol, R = 8.314472 J/(mol*K) => Ea/R = 10,000 K
     * Reading 0: t = 0h, 5.0 C (278.15 K) [baseline]
     * Reading 1: t = 1h, 5.0 C (278.15 K), dt1 = 1 hour
     * Reading 2: t = 3h, 25.0 C (298.15 K), dt2 = 2 hours (uneven interval!)
     * Reading 3: t = 8h, 5.0 C (278.15 K), dt3 = 5 hours (5h offline gap!)
     *
     * Total duration = 1h + 2h + 5h = 8 hours (28,800 s)
     * e^(-10000/278.15) = 2.433876e-16
     * e^(-10000/298.15) = 2.707335e-15
     * Sum = 1 * 2.433876e-16 + 2 * 2.707335e-15 + 5 * 2.433876e-16 = 6.874984e-15 hours
     * Average S = 6.874984e-15 / 8 = 8.593730e-16
     * ln(S) = -34.689617
     * Tk = 10000 / 34.689617 = 288.2707 K
     * MKT (C) = 288.2707 - 273.15 = 15.1207 C
     */
    const baseTime = new Date('2026-10-10T00:00:00Z').getTime();
    const readings = [
      { timestamp: new Date(baseTime).toISOString(), temperature: 5.0 },
      { timestamp: new Date(baseTime + 1 * 3600000).toISOString(), temperature: 5.0 },
      { timestamp: new Date(baseTime + 3 * 3600000).toISOString(), temperature: 25.0 },
      { timestamp: new Date(baseTime + 8 * 3600000).toISOString(), temperature: 5.0 },
    ];

    const result = calculateMKT(readings, 83144.72);

    expect(result.totalDurationHours).toBe(8.0);
    expect(result.intervalCount).toBe(3);
    // Matches hand-calculated theoretical MKT of 15.12 C to within 0.05 C
    expect(result.mktCelsius).toBeCloseTo(15.12, 1);
    expect(result.mktKelvin).toBeCloseTo(288.27, 1);
  });

  // Acceptance Check 2: Reproducibility & Determinism (run twice, compare)
  it('Acceptance Check 2: The same input always gives the same hash and the same MKT (run twice, compare)', () => {
    const readings = [
      { timestamp: '2026-10-10T01:00:00Z', temperature: 4.5 },
      { timestamp: '2026-10-10T02:00:00Z', temperature: 5.2 },
      { timestamp: '2026-10-10T03:30:00Z', temperature: 6.8 },
    ];

    const batchData = {
      device_id: 'dev-001',
      shipment_id: 'sh-001',
      sequence_no: 1,
      prev_hash: GENESIS_PREV_HASH,
      payload: { readings: [{ timestamp: '2026-10-10T01:00:00Z', temperature: 4.5, humidity: 50.0 }] },
    };

    // Run 1
    const hash1 = computeBatchHash(batchData);
    const mkt1 = calculateMKT(readings);
    const shelf1 = calculateRemainingShelfLife(readings, testProfileParams);

    // Run 2
    const hash2 = computeBatchHash(batchData);
    const mkt2 = calculateMKT(readings);
    const shelf2 = calculateRemainingShelfLife(readings, testProfileParams);

    // Exact equality check
    expect(hash1).toBe(hash2);
    expect(mkt1.mktCelsius).toBe(mkt2.mktCelsius);
    expect(mkt1.mktKelvin).toBe(mkt2.mktKelvin);
    expect(shelf1.consumedFraction).toBe(shelf2.consumedFraction);
    expect(shelf1.remainingLifeHours).toBe(shelf2.remainingLifeHours);
  });

  // Acceptance Check 3: A spike simulation triggers a deterministic alert within 30 seconds
  it('Acceptance Check 3: A spike simulation triggers a deterministic alert within 30 seconds', async () => {
    const sim = new DeviceSimulator({
      deviceId,
      shipmentId,
      privateKeyHex: deviceKeys.privateKeyHex,
      publicKeyHex: deviceKeys.publicKeyHex,
    });

    // Generate spike batch: reading temperature 19.8 C (well above allowed 8.0 C)
    const spikeBatch = sim.createBatch({ temperature: 19.8, humidity: 50.0 });

    const ingestRes = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', webhookSecret)
      .send(spikeBatch);

    expect(ingestRes.status).toBe(201);
    expect(ingestRes.body.status).toBe('accepted');
    const batchId = ingestRes.body.batch_id;

    // Run deterministic processing
    const processResult = await processBatchDeterministic(batchId, shipmentId);

    // Verify alert delivery latency is well below 30 seconds
    expect(processResult.deliveryLatencyMs).toBeLessThan(30000);

    // Verify deterministic alert was created
    expect(processResult.alertsCreated.length).toBeGreaterThanOrEqual(1);
    const thermalAlert = processResult.alertsCreated.find((a) => a.type === 'thermal_excursion_high');
    expect(thermalAlert).toBeDefined();
    expect(thermalAlert?.source).toBe('deterministic');
    expect(thermalAlert?.severity).toBe('critical');

    // Verify stored in database
    const dbAlerts = await testDb.query(
      "SELECT * FROM alerts WHERE shipment_id = $1 AND source = 'deterministic' AND type = 'thermal_excursion_high'",
      [shipmentId]
    );
    expect(dbAlerts.rowCount).toBeGreaterThanOrEqual(1);

    // Verify shelf_life_trail record stored for audit
    const trail = await testDb.query(
      'SELECT * FROM shelf_life_trail WHERE shipment_id = $1 AND batch_id = $2',
      [shipmentId, batchId]
    );
    expect(trail.rowCount).toBe(1);
    expect(Number(trail.rows[0].mkt)).toBeGreaterThan(0);
    expect(Number(trail.rows[0].remaining_life)).toBeLessThanOrEqual(testProfileParams.ref_shelf_life_hours);
  });

  // Acceptance Check 4: Modules do not import anything from /ai-service
  it('Acceptance Check 4: Deterministic modules do not import anything from /ai-service', () => {
    const dirsToScan = [
      path.resolve(__dirname, '../../shared/src'),
      path.resolve(__dirname, '../../backend/src'),
      path.resolve(__dirname, '../../worker/src'),
      path.resolve(__dirname, '../../contracts/contracts'),
    ];

    const forbiddenImports = ['ai-service', 'ai_service', '/ai/', '@frostledger/ai-service'];

    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir, { recursive: true }) as string[];
        for (const file of files) {
          const filePath = path.join(dir, file);
          if (fs.statSync(filePath).isFile() && (file.endsWith('.ts') || file.endsWith('.sol'))) {
            const content = fs.readFileSync(filePath, 'utf8');
            for (const forbidden of forbiddenImports) {
              const hasForbiddenImport = content.includes(`from '${forbidden}`) ||
                content.includes(`from "${forbidden}`) ||
                content.includes(`require('${forbidden}`) ||
                content.includes(`require("${forbidden}`);
              expect(
                hasForbiddenImport,
                `Forbidden AI import '${forbidden}' found in deterministic file: ${filePath}`
              ).toBe(false);
            }
          }
        }
      }
    }
  });

  // Acceptance Check 5: Alert acknowledgement endpoint with note written to audit log
  it('Acceptance Check 5: Alert acknowledgement endpoint records note and writes to audit log', async () => {
    // Fetch latest alert created
    const alertsRes = await request(app)
      .get(`/alerts?shipment_id=${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(alertsRes.status).toBe(200);
    expect(alertsRes.body.alerts.length).toBeGreaterThan(0);
    const alertId = alertsRes.body.alerts[0].alert_id;

    // Acknowledge alert
    const ackRes = await request(app)
      .post(`/alerts/${alertId}/acknowledge`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ note: 'Refrigeration unit door re-sealed and compressor active' });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.acknowledged_by).toBe('operator3@coldchain.test');
    expect(ackRes.body.note).toBe('Refrigeration unit door re-sealed and compressor active');

    // Verify audit log recorded the action
    const auditRes = await testDb.query(
      "SELECT * FROM audit_log WHERE action = 'alert_acknowledgement' AND target = $1",
      [`alert:${alertId}`]
    );
    expect(auditRes.rowCount).toBe(1);
    expect(auditRes.rows[0].actor).toBe('operator3@coldchain.test');
  });
});
