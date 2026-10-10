import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { setTestDbClient, DbClient } from '../src/db';
import {
  generateEd25519KeyPair,
  getUtcTimestamp,
  computeCanonicalHash,
  ProfileParameters,
} from '@frostledger/shared';
import { DeviceSimulator } from '@frostledger/simulator';
import { blockchainService, checkAndCloseBatchWindow } from '../src/services/blockchainService';

describe('Stage 4: Blockchain Anchoring, Worker Retries & Arrival Verification', () => {
  let app: any;
  let pglite: PGlite;
  let testDb: DbClient;
  const webhookSecret = 'test_webhook_stage4';
  const deviceId = 'dev-chain-001';
  const shipmentId = 'shipment-chain-001';
  let deviceKeys: { publicKeyHex: string; privateKeyHex: string };

  const vaccineProfile: ProfileParameters = {
    name: 'Pfizer-BioNTech Vaccine',
    cargo_type: 'vaccine',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    ref_temp_c: 4.0,
    ref_shelf_life_hours: 720.0,
    activation_energy_j_mol: 83144.0,
    humidity_min_pct: 20.0,
    humidity_max_pct: 60.0,
    max_shock_g: 3.0,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
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

    // Register active device
    deviceKeys = generateEd25519KeyPair();
    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, 'org-chain', deviceKeys.publicKeyHex, 'active', getUtcTimestamp()]
    );

    // Register profile & shipment
    await testDb.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['profile-vax-v1', 1, JSON.stringify(vaccineProfile), 'system-test', getUtcTimestamp()]
    );

    const profileHash = computeCanonicalHash(vaccineProfile);
    await testDb.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [shipmentId, deviceId, 'profile-vax-v1', 1, profileHash, 'in_transit', getUtcTimestamp()]
    );

    // Register shipment on-chain
    await blockchainService.registerShipmentOnChain(
      shipmentId,
      profileHash,
      vaccineProfile.temp_min_c,
      vaccineProfile.temp_max_c
    );
  });

  afterAll(async () => {
    blockchainService.clearState();
    await testDb.close();
    setTestDbClient(null);
  });

  // Acceptance Check 1: Simulated shipment with batch window anchoring and arrival verification
  it('Acceptance Check 1 & 2: Ingests batches, anchors batch window on-chain, and GET /verify passes all checks', async () => {
    const sim = new DeviceSimulator({
      deviceId,
      shipmentId,
      privateKeyHex: deviceKeys.privateKeyHex,
      publicKeyHex: deviceKeys.publicKeyHex,
    });

    // Ingest window of 5 batches
    const batches = sim.generateScenarioBatches('normal', 5);
    for (const b of batches) {
      const res = await request(app)
        .post('/telemetry')
        .set('x-webhook-secret', webhookSecret)
        .send(b);
      expect(res.status).toBe(201);
    }

    // Worker closes batch window (size 5) and anchors to blockchain
    const anchorResult = await checkAndCloseBatchWindow(shipmentId, 5);
    expect(anchorResult).not.toBeNull();
    expect(anchorResult?.txHash).toBeDefined();
    expect(anchorResult?.startSeq).toBe(1);
    expect(anchorResult?.endSeq).toBe(5);

    // Verify all 5 batch anchors in DB are updated to 'anchored'
    const anchorsRes = await testDb.query(
      "SELECT * FROM anchors WHERE status = 'anchored'",
      []
    );
    expect(anchorsRes.rowCount).toBe(5);

    // GET /verify/:shipmentId should PASS all checks
    const verifyRes = await request(app).get(`/verify/${shipmentId}`);
    expect(verifyRes.status).toBe(200);
    const report = verifyRes.body;

    expect(report.status).toBe('PASS');
    expect(report.total_batches).toBe(5);
    expect(report.profile_integrity_pass).toBe(true);
    expect(report.checks.hash_integrity.pass).toBe(true);
    expect(report.checks.signature_authenticity.pass).toBe(true);
    expect(report.checks.hash_chain_continuity.pass).toBe(true);
    expect(report.checks.sequence_continuity.pass).toBe(true);
    expect(report.checks.blockchain_anchors.pass).toBe(true);
    expect(report.tampered_batches.length).toBe(0);
  });

  // Acceptance Check 3: Edit a stored batch row by hand in the database; GET /verify returns a mismatch
  it('Acceptance Check 3: Edit a stored batch row by hand in the database; GET /verify returns a mismatch for that batch', async () => {
    // Tamper with sequence 3 payload directly in the database (simulating database breach/alteration)
    const tamperedPayload = {
      readings: [
        {
          timestamp: '2026-10-10T02:00:00Z',
          temperature: 35.0, // Altered from original ~4.5 C!
          humidity: 90.0,
        },
      ],
    };

    await testDb.query(
      'UPDATE batches SET payload = $1 WHERE shipment_id = $2 AND sequence_no = 3',
      [JSON.stringify(tamperedPayload), shipmentId]
    );

    // GET /verify/:shipmentId must catch the mismatch and FAIL
    const verifyRes = await request(app).get(`/verify/${shipmentId}`);
    expect(verifyRes.status).toBe(200);
    const report = verifyRes.body;

    expect(report.status).toBe('FAIL');
    expect(report.checks.hash_integrity.pass).toBe(false);
    expect(report.tampered_batches).toContain(3);

    const hashMismatchFailure = report.checks.hash_integrity.failures.find((f: string) =>
      f.includes('seq 3')
    );
    expect(hashMismatchFailure).toBeDefined();

    // Restore batch sequence 3 payload for subsequent tests
    const sim = new DeviceSimulator({
      deviceId,
      shipmentId,
      privateKeyHex: deviceKeys.privateKeyHex,
      publicKeyHex: deviceKeys.publicKeyHex,
    });
    const originalBatch = sim.generateScenarioBatches('normal', 3)[2];
    await testDb.query(
      'UPDATE batches SET payload = $1 WHERE shipment_id = $2 AND sequence_no = 3',
      [JSON.stringify(originalBatch.payload), shipmentId]
    );
  });

  // Acceptance Check 4: Disconnect chain RPC: ingestion continues, anchors show retries, succeed after reconnection
  it('Acceptance Check 4: Disconnect chain RPC: ingestion continues, anchors show retries, and succeed after reconnection', async () => {
    // 1. Simulate blockchain RPC disconnection (network split / RPC provider down)
    blockchainService.setRpcConnected(false);

    // Create a new test device and shipment for offline test
    const offlineDeviceId = 'dev-chain-offline-002';
    const offlineShipmentId = 'shipment-chain-offline-001';

    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [offlineDeviceId, 'org-chain', deviceKeys.publicKeyHex, 'active', getUtcTimestamp()]
    );

    await testDb.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [offlineShipmentId, offlineDeviceId, 'profile-vax-v1', 1, computeCanonicalHash(vaccineProfile), 'in_transit', getUtcTimestamp()]
    );

    const sim = new DeviceSimulator({
      deviceId: offlineDeviceId,
      shipmentId: offlineShipmentId,
      privateKeyHex: deviceKeys.privateKeyHex,
      publicKeyHex: deviceKeys.publicKeyHex,
    });

    // 2. Ingestion continues unimpeded even with RPC completely disconnected!
    const batches = sim.generateScenarioBatches('normal', 5);
    for (const b of batches) {
      const res = await request(app)
        .post('/telemetry')
        .set('x-webhook-secret', webhookSecret)
        .send(b);

      expect(res.status).toBe(201); // Ingestion NEVER blocked by chain outage!
    }

    // 3. Attempting to anchor fails and leaves anchors in 'pending' status with incremented attempts
    const failedResult = await checkAndCloseBatchWindow(offlineShipmentId, 5, 2);
    expect(failedResult).toBeNull();

    const pendingAnchors = await testDb.query(
      "SELECT attempts, status FROM anchors WHERE status = 'pending'",
      []
    );
    expect(pendingAnchors.rowCount).toBe(5);
    expect(Number(pendingAnchors.rows[0].attempts)).toBeGreaterThanOrEqual(1);

    // 4. Reconnect RPC provider
    blockchainService.setRpcConnected(true);

    // Re-register shipment on-chain
    await blockchainService.registerShipmentOnChain(
      offlineShipmentId,
      computeCanonicalHash(vaccineProfile),
      vaccineProfile.temp_min_c,
      vaccineProfile.temp_max_c
    );

    // 5. Subsequent anchoring retry succeeds
    const retryResult = await checkAndCloseBatchWindow(offlineShipmentId, 5, 2);
    expect(retryResult).not.toBeNull();
    expect(retryResult?.txHash).toBeDefined();

    const anchoredCount = await testDb.query(
      "SELECT count(*) as cnt FROM anchors WHERE status = 'anchored'",
      []
    );
    expect(Number(anchoredCount.rows[0].cnt)).toBeGreaterThanOrEqual(5);
  });

  // Acceptance Check 5: Printable HTML Integrity Report with AI advisory separation
  it('Acceptance Check 5: GET /verify/:shipmentId/report returns HTML certificate with isolated AI section', async () => {
    // Add sample AI advisory insight to test separation
    await testDb.query(
      `INSERT INTO ai_insights (
        insight_id, shipment_id, kind, score, severity, explanation, input_ref, warmup_status, model_name, model_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'ai-ins-test-01',
        shipmentId,
        'anomaly',
        0.75,
        'warning',
        'Slight elevation in door sensor acceleration readings',
        'batches:1-5',
        'active',
        'River-HST',
        '1.0.0',
        getUtcTimestamp(),
      ]
    );

    const reportRes = await request(app)
      .get(`/verify/${shipmentId}/report`)
      .set('Accept', 'text/html');

    expect(reportRes.status).toBe(200);
    expect(reportRes.headers['content-type']).toMatch(/text\/html/);

    const html = reportRes.text;
    expect(html).toContain('FrostLedger Official Integrity Audit Report');
    expect(html).toContain('Deterministic Verification Checklist');
    expect(html).toContain('AI/ML Advisory Observations');
    expect(html).toContain('AI-generated, advisory');
    expect(html).toContain('Official alerts and records are shown above and never depend on AI.');
  });
});
