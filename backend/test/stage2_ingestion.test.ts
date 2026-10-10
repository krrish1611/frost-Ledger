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
  GENESIS_PREV_HASH,
} from '@frostledger/shared';
import { DeviceSimulator } from '@frostledger/simulator';
import { getMemoryEnqueuedJobs, clearMemoryEnqueuedJobs } from '../src/services/queueService';

describe('Stage 2: Ingestion & Device Simulator Acceptance Tests', () => {
  let app: any;
  let pglite: PGlite;
  let testDb: DbClient;
  const webhookSecret = 'test_webhook_secret_for_stage2';
  let deviceKeyPair: { publicKeyHex: string; privateKeyHex: string };
  const deviceId = 'dev-sim-active-001';
  const shipmentId = 'shipment-sim-001';

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

    // Run migrations
    await runMigrations(testDb);

    // Register active device
    deviceKeyPair = generateEd25519KeyPair();
    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, 'org-test', deviceKeyPair.publicKeyHex, 'active', getUtcTimestamp()]
    );

    // Register profile & shipment
    const profileParams = {
      name: 'Cold Storage Vaccine Profile',
      cargo_type: 'vaccine',
      temp_min_c: 2.0,
      temp_max_c: 8.0,
      ref_temp_c: 5.0,
      ref_shelf_life_hours: 720.0,
      activation_energy_j_mol: 83144.0,
    };
    await testDb.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['profile-test-v1', 1, JSON.stringify(profileParams), 'system-test', getUtcTimestamp()]
    );

    const profileHash = computeCanonicalHash(profileParams);
    await testDb.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [shipmentId, deviceId, 'profile-test-v1', 1, profileHash, 'in_transit', getUtcTimestamp()]
    );
  });

  afterAll(async () => {
    await testDb.close();
    setTestDbClient(null);
  });

  // Acceptance Check 1: Webhook authentication verification
  it('Webhook Auth: Rejects telemetry calls without valid x-webhook-secret header', async () => {
    const res = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', 'wrong_secret')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED_WEBHOOK');
  });

  // Acceptance Check 2: Valid batch is accepted; the same batch again is ignored without error
  it('Acceptance Check 2: Valid batch is accepted, and duplicate batch is ignored idempotently', async () => {
    clearMemoryEnqueuedJobs();
    const sim = new DeviceSimulator({
      deviceId,
      shipmentId,
      privateKeyHex: deviceKeyPair.privateKeyHex,
      publicKeyHex: deviceKeyPair.publicKeyHex,
    });

    const batch1 = sim.createBatch({ temperature: 4.2, humidity: 48.0 });
    expect(batch1.sequence_no).toBe(1);
    expect(batch1.prev_hash).toBe(GENESIS_PREV_HASH);

    // 1. Initial send must succeed with 201
    const res1 = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', webhookSecret)
      .send(batch1);

    expect(res1.status).toBe(201);
    expect(res1.body.status).toBe('accepted');
    expect(res1.body.sequence_no).toBe(1);

    // Verify worker job was enqueued
    const enqueued = getMemoryEnqueuedJobs();
    expect(enqueued.length).toBe(1);
    expect(enqueued[0].sequence_no).toBe(1);

    // 2. Duplicate send (same batch again) must return 200 without error
    const resDuplicate = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', webhookSecret)
      .send(batch1);

    expect(resDuplicate.status).toBe(200);
    expect(resDuplicate.body.status).toBe('duplicate');
    expect(resDuplicate.body.message).toMatch(/idempotent/i);

    // Verify database has exactly 1 row for seq 1
    const dbBatches = await testDb.query('SELECT * FROM batches WHERE device_id = $1', [deviceId]);
    expect(dbBatches.rowCount).toBe(1);
  });

  // Acceptance Check 3: Unsigned batch is rejected and creates a security alert
  it('Acceptance Check 3.1: Unsigned / corrupted signature batch is rejected and creates security alert', async () => {
    const sim = new DeviceSimulator({
      deviceId,
      shipmentId,
      privateKeyHex: deviceKeyPair.privateKeyHex,
      publicKeyHex: deviceKeyPair.publicKeyHex,
    });
    // Set simulator state to match current last batch
    const lastBatch = (await testDb.query('SELECT hash FROM batches WHERE device_id = $1 ORDER BY sequence_no DESC LIMIT 1', [deviceId])).rows[0];
    
    const unsignedBatch = sim.createBatch({
      temperature: 5.0,
      humidity: 50.0,
      forceSeq: 2,
      forcePrevHash: lastBatch.hash,
      corruptSignature: true,
    });

    const res = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', webhookSecret)
      .send(unsignedBatch);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');

    // Verify security alert was generated
    const alerts = await testDb.query(
      "SELECT * FROM alerts WHERE shipment_id = $1 AND source = 'security' AND type = 'bad_signature'",
      [shipmentId]
    );
    expect(alerts.rowCount).toBeGreaterThanOrEqual(1);
  });

  // Acceptance Check 3.2: Replayed (old sequence) batch is rejected and creates a security alert
  it('Acceptance Check 3.2: Replayed (old sequence) batch is rejected and creates a security alert', async () => {
    // Current highest sequence is 1. Attempt to send sequence 1 with different data or same sequence
    const sim = new DeviceSimulator({
      deviceId,
      shipmentId,
      privateKeyHex: deviceKeyPair.privateKeyHex,
      publicKeyHex: deviceKeyPair.publicKeyHex,
    });

    const replayBatch = sim.createBatch({
      temperature: 99.0, // altered data
      humidity: 99.0,
      forceSeq: 1, // Already exists!
      forcePrevHash: GENESIS_PREV_HASH,
    });

    const res = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', webhookSecret)
      .send(replayBatch);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SEQUENCE_CONFLICT');

    // Verify security alert
    const alerts = await testDb.query(
      "SELECT * FROM alerts WHERE shipment_id = $1 AND source = 'security' AND type = 'replay_conflict'",
      [shipmentId]
    );
    expect(alerts.rowCount).toBeGreaterThanOrEqual(1);
  });

  // Acceptance Check 3.3: Gapped batch is rejected and creates a security alert
  it('Acceptance Check 3.3: Gapped batch is rejected and creates a security alert', async () => {
    const sim = new DeviceSimulator({
      deviceId,
      shipmentId,
      privateKeyHex: deviceKeyPair.privateKeyHex,
      publicKeyHex: deviceKeyPair.publicKeyHex,
    });

    // Send sequence 5 when last recorded sequence is 1 (gap of 4)
    const gappedBatch = sim.createBatch({
      temperature: 4.5,
      humidity: 50.0,
      forceSeq: 5,
      forcePrevHash: 'a'.repeat(64),
    });

    const res = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', webhookSecret)
      .send(gappedBatch);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SEQUENCE_GAP');

    // Verify security alert
    const alerts = await testDb.query(
      "SELECT * FROM alerts WHERE shipment_id = $1 AND source = 'security' AND type = 'sequence_gap'",
      [shipmentId]
    );
    expect(alerts.rowCount).toBeGreaterThanOrEqual(1);
  });

  // Acceptance Check 4: Revoked device's batch is rejected immediately
  it("Acceptance Check 4: A revoked device's batch is rejected immediately (403)", async () => {
    const revokedKeys = generateEd25519KeyPair();
    const revokedDeviceId = 'dev-revoked-001';

    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [revokedDeviceId, 'org-test', revokedKeys.publicKeyHex, 'revoked', getUtcTimestamp(), getUtcTimestamp()]
    );

    const revokedSim = new DeviceSimulator({
      deviceId: revokedDeviceId,
      shipmentId,
      privateKeyHex: revokedKeys.privateKeyHex,
      publicKeyHex: revokedKeys.publicKeyHex,
    });

    const batch = revokedSim.createBatch({ temperature: 4.5, humidity: 50.0 });

    const res = await request(app)
      .post('/telemetry')
      .set('x-webhook-secret', webhookSecret)
      .send(batch);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEVICE_REVOKED');

    // Verify security alert
    const alerts = await testDb.query(
      "SELECT * FROM alerts WHERE source = 'security' AND type = 'revoked_device'",
      []
    );
    expect(alerts.rowCount).toBeGreaterThanOrEqual(1);
  });

  // Acceptance Check 5: offline_gap scenario
  it('Acceptance Check 5: offline_gap scenario: cached batches sent late, in order, are accepted with zero loss and zero duplicates', async () => {
    // Create new device and shipment for offline test
    const offlineKeys = generateEd25519KeyPair();
    const offlineDevId = 'dev-offline-cache-001';
    const offlineShipmentId = 'shipment-offline-001';

    await testDb.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [offlineDevId, 'org-test', offlineKeys.publicKeyHex, 'active', getUtcTimestamp()]
    );

    await testDb.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash, status, start_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [offlineShipmentId, offlineDevId, 'profile-test-v1', 1, 'b'.repeat(64), 'in_transit', getUtcTimestamp()]
    );

    const sim = new DeviceSimulator({
      deviceId: offlineDevId,
      shipmentId: offlineShipmentId,
      privateKeyHex: offlineKeys.privateKeyHex,
      publicKeyHex: offlineKeys.publicKeyHex,
    });

    // Generate 6 batches offline
    const cachedBatches = sim.generateScenarioBatches('offline_gap', 6);
    expect(cachedBatches.length).toBe(6);

    // Send all cached batches in sequence when reconnecting
    for (const batch of cachedBatches) {
      const res = await request(app)
        .post('/telemetry')
        .set('x-webhook-secret', webhookSecret)
        .send(batch);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('accepted');
    }

    // Verify all 6 batches are stored with exact sequence continuity (1 to 6)
    const stored = await testDb.query(
      'SELECT sequence_no, prev_hash, hash FROM batches WHERE device_id = $1 ORDER BY sequence_no ASC',
      [offlineDevId]
    );

    expect(stored.rowCount).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(Number(stored.rows[i].sequence_no)).toBe(i + 1);
      if (i > 0) {
        expect(stored.rows[i].prev_hash).toBe(stored.rows[i - 1].hash);
      }
    }
  });

  // Acceptance Check 6: POST /events stores physical handling shock events
  it('POST /events: accepts and stores physical handling shock/tilt events', async () => {
    const eventPayload = {
      shipment_id: shipmentId,
      type: 'shock',
      magnitude: 4.8,
      timestamp: getUtcTimestamp(),
    };

    const res = await request(app)
      .post('/events')
      .set('x-webhook-secret', webhookSecret)
      .send(eventPayload);

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('shock');
    expect(res.body.magnitude).toBe(4.8);

    const dbEvents = await testDb.query('SELECT * FROM events WHERE shipment_id = $1', [shipmentId]);
    expect(dbEvents.rowCount).toBeGreaterThanOrEqual(1);
  });
});
