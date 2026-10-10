import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { setTestDbClient, DbClient } from '../src/db';
import {
  ADVISORY_LABEL,
  generateEd25519KeyPair,
  getUtcTimestamp,
  computeCanonicalHash,
  ProfileParameters,
} from '@frostledger/shared';

describe('Stage 6: Risk Scoring & Notifications Integration', () => {
  let app: any;
  let pglite: PGlite;
  let testDb: DbClient;
  const JWT_SECRET = 'frostledger_default_development_secret_32_chars';
  let operatorToken: string;

  const deviceId = 'dev-stage6-001';
  const shipmentId = 'shipment-stage6-001';
  let deviceKeys: { publicKeyHex: string; privateKeyHex: string };

  const biologicsProfile: ProfileParameters = {
    name: 'Insulin Biologics Stage 6',
    cargo_type: 'biologics',
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
    process.env.JWT_SECRET = JWT_SECRET;

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

    // Operator auth token
    operatorToken = jwt.sign(
      {
        user_id: 'usr-stage6-operator',
        email: 'operator@frostledger.io',
        role: 'operator',
        org_id: 'org-stage6',
      },
      JWT_SECRET
    );

    // Device
    deviceKeys = generateEd25519KeyPair();
    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, 'org-stage6', deviceKeys.publicKeyHex, 'active', getUtcTimestamp()]
    );

    // Profile & Shipment
    await testDb.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['profile-biologics-stage6', 1, JSON.stringify(biologicsProfile), 'system-test', getUtcTimestamp()]
    );

    const profileHash = computeCanonicalHash(biologicsProfile);
    await testDb.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time, ai_enabled, ai_email_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [shipmentId, deviceId, 'profile-biologics-stage6', 1, profileHash, 'in_transit', getUtcTimestamp(), true, true]
    );
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('Check 1: GET /ai/risk/:shipmentId rejects unauthenticated requests', async () => {
    const res = await request(app).get(`/ai/risk/${shipmentId}`);
    expect(res.status).toBe(401);
  });

  it('Check 2: GET /ai/risk/:shipmentId returns 404 for unknown shipment', async () => {
    const res = await request(app)
      .get('/ai/risk/unknown-shipment-xyz')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHIPMENT_NOT_FOUND');
  });

  it('Check 3: GET /ai/risk/:shipmentId returns baseline risk with advisory label', async () => {
    const res = await request(app)
      .get(`/ai/risk/${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shipmentId).toBe(shipmentId);
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.tier).toBe('LOW');
    expect(res.body.compositeRiskScore).toBeLessThan(25);
    expect(res.body.factors.thermalRisk).toBeDefined();
    expect(res.body.factors.anomalyRisk).toBeDefined();
    expect(res.body.recommendation).toBeDefined();
  });

  it('Check 4: GET /ai/risk/:shipmentId reflects stored elevated risk insight', async () => {
    // Insert elevated risk insight
    await testDb.query(
      `INSERT INTO ai_insights (
        insight_id, shipment_id, kind, score, severity, explanation,
        input_ref, warmup_status, model_name, model_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'ins_risk_critical_01',
        shipmentId,
        'risk',
        0.82,
        'critical',
        'Composite risk assessed at 82.0/100 (CRITICAL). Rapid thermal breach detected.',
        'batch_crit_01',
        'active',
        'composite_risk_scorer',
        'v1.0.0',
        getUtcTimestamp(),
      ]
    );

    const res = await request(app)
      .get(`/ai/risk/${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.compositeRiskScore).toBe(82);
    expect(res.body.tier).toBe('CRITICAL');
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.explanation).toContain('CRITICAL');
    expect(res.body.recommendation).toContain('Immediate operational intervention');
  });

  it('Check 5: GET /ai/notifications/:shipmentId returns logged notification attempts', async () => {
    // Insert notifications into ai_notifications table
    await testDb.query(
      `INSERT INTO ai_notifications (
        notification_id, insight_id, shipment_id, sent_at, status
      ) VALUES ($1, $2, $3, $4, $5)`,
      ['notif_001', 'ins_risk_critical_01', shipmentId, getUtcTimestamp(), 'sent']
    );

    await testDb.query(
      `INSERT INTO ai_notifications (
        notification_id, insight_id, shipment_id, sent_at, status
      ) VALUES ($1, $2, $3, $4, $5)`,
      ['notif_002', 'ins_risk_critical_01', shipmentId, getUtcTimestamp(), 'suppressed']
    );

    const res = await request(app)
      .get(`/ai/notifications/${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shipmentId).toBe(shipmentId);
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.count).toBe(2);
    expect(res.body.notifications[0].label).toBe(ADVISORY_LABEL);
    expect(res.body.notifications.some((n: any) => n.status === 'sent')).toBe(true);
    expect(res.body.notifications.some((n: any) => n.status === 'suppressed')).toBe(true);
  });

  it('Check 6: Official deterministic alerts table remains 100% untouched by AI notifications', async () => {
    const alertsRes = await testDb.query('SELECT * FROM alerts WHERE shipment_id = $1', [shipmentId]);
    expect(alertsRes.rowCount).toBe(0);

    const notifRes = await testDb.query('SELECT * FROM ai_notifications WHERE shipment_id = $1', [shipmentId]);
    expect(notifRes.rowCount).toBe(2);
  });
});
