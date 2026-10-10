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

describe('Stage 5: AI Engine Core & Advisory Integration', () => {
  let app: any;
  let pglite: PGlite;
  let testDb: DbClient;
  const JWT_SECRET = 'frostledger_default_development_secret_32_chars';
  let operatorToken: string;

  const deviceId = 'dev-ai-stage5-001';
  const shipmentId = 'shipment-ai-stage5-001';
  let deviceKeys: { publicKeyHex: string; privateKeyHex: string };

  const vaccineProfile: ProfileParameters = {
    name: 'Pfizer-BioNTech Vaccine Stage 5',
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

    // Generate operator auth token
    operatorToken = jwt.sign(
      {
        user_id: 'usr-stage5-operator',
        email: 'operator@frostledger.io',
        role: 'operator',
        org_id: 'org-stage5',
      },
      JWT_SECRET
    );

    // Register active device
    deviceKeys = generateEd25519KeyPair();
    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, 'org-stage5', deviceKeys.publicKeyHex, 'active', getUtcTimestamp()]
    );

    // Register profile & shipment
    await testDb.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['profile-ai-stage5', 1, JSON.stringify(vaccineProfile), 'system-test', getUtcTimestamp()]
    );

    const profileHash = computeCanonicalHash(vaccineProfile);
    await testDb.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time, ai_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [shipmentId, deviceId, 'profile-ai-stage5', 1, profileHash, 'in_transit', getUtcTimestamp(), true]
    );
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('Check 1: GET /ai/insights/:shipmentId rejects unauthenticated requests', async () => {
    const res = await request(app).get(`/ai/insights/${shipmentId}`);
    expect(res.status).toBe(401);
  });

  it('Check 2: GET /ai/insights/:shipmentId returns 404 for non-existent shipment', async () => {
    const res = await request(app)
      .get('/ai/insights/non-existent-shipment')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHIPMENT_NOT_FOUND');
  });

  it('Check 3: GET /ai/insights/:shipmentId returns empty list with mandatory advisory label', async () => {
    const res = await request(app)
      .get(`/ai/insights/${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shipmentId).toBe(shipmentId);
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.ai_enabled).toBe(true);
    expect(res.body.count).toBe(0);
    expect(res.body.insights).toEqual([]);
  });

  it('Check 4: GET /ai/status/:shipmentId returns uninitialized before any checkpoint', async () => {
    const res = await request(app)
      .get(`/ai/status/${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shipmentId).toBe(shipmentId);
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.model_status).toBe('uninitialized');
  });

  it('Check 5: GET /ai/insights/:shipmentId retrieves stored insights with advisory label', async () => {
    // Insert mock insights directly into ai_insights table
    await testDb.query(
      `INSERT INTO ai_insights (
        insight_id, shipment_id, kind, score, severity, explanation,
        input_ref, warmup_status, model_name, model_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'ins_test_001',
        shipmentId,
        'anomaly',
        0.87,
        'warning',
        'Rapid temperature jump detected: +3.20°C in 1.0 min',
        'batch_test_01',
        'active',
        'rate_of_change_detector',
        'v1.0.0',
        getUtcTimestamp(),
      ]
    );

    await testDb.query(
      `INSERT INTO ai_insights (
        insight_id, shipment_id, kind, score, severity, explanation,
        input_ref, warmup_status, model_name, model_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'ins_test_002',
        shipmentId,
        'forecast',
        0.78,
        'warning',
        'Positive drift detected in temperature by CUSUM tracker',
        'batch_test_02',
        'active',
        'cusum_drift_detector',
        'v1.0.0',
        getUtcTimestamp(),
      ]
    );

    const res = await request(app)
      .get(`/ai/insights/${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.insights[0].label).toBe(ADVISORY_LABEL);
    expect(res.body.insights[0].explanation).toBeDefined();
    expect(res.body.insights[0].score).toBeGreaterThan(0);
  });

  it('Check 6: GET /ai/status/:shipmentId returns active status after checkpoint is saved', async () => {
    // Save checkpoint into ai_model_state
    const mockState = {
      sample_count: 35,
      warmup_samples: 30,
      last_batch_id: 'batch_test_02',
    };

    await testDb.query(
      `INSERT INTO ai_model_state (shipment_id, model_version, state, last_batch_id, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [shipmentId, 'v1.0.0', JSON.stringify(mockState), 'batch_test_02', getUtcTimestamp()]
    );

    const res = await request(app)
      .get(`/ai/status/${shipmentId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shipmentId).toBe(shipmentId);
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.warmup_status).toBe('active');
    expect(res.body.sample_count).toBe(35);
    expect(res.body.last_batch_id).toBe('batch_test_02');
  });

  it('Check 7: Official deterministic records remain strictly isolated from AI insights', async () => {
    // Verify that alerts table has 0 alerts despite ai_insights having 2 rows
    const alertsRes = await testDb.query('SELECT * FROM alerts WHERE shipment_id = $1', [shipmentId]);
    expect(alertsRes.rowCount).toBe(0);

    // AI insights count is 2
    const insightsRes = await testDb.query('SELECT * FROM ai_insights WHERE shipment_id = $1', [shipmentId]);
    expect(insightsRes.rowCount).toBe(2);
  });
});
