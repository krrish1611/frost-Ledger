import crypto from 'node:crypto';
import { getDbClient } from './index';
import { runSeed } from './seed';
import {
  computeBatchHash,
  computeCanonicalHash,
  generateEd25519KeyPair,
  GENESIS_PREV_HASH,
  getUtcTimestamp,
  signWithEd25519,
} from '@frostledger/shared';
import { processBatchDeterministic } from '../services/deterministicCore';
import { blockchainService, checkAndCloseBatchWindow } from '../services/blockchainService';
import { writeAuditLog } from '../services/auditService';

export interface KeyPair {
  publicKeyHex: string;
  privateKeyHex: string;
}

// Store active device keypairs in memory so live ESP-32 packets (Wi-Fi HTTP or Web Serial USB)
// can be cryptographically chained & signed if the microcontroller sends raw sensor readings,
// or verified directly if the ESP-32 sends pre-signed packets.
const deviceKeyRegistry = new Map<string, KeyPair>();
const deviceHeartbeatRegistry = new Map<string, { lastSeen: string; rssi?: number; ip?: string; transport?: string; batteryPct?: number; firmwareVersion?: string }>();

export function getDeviceKeyPair(deviceId: string): KeyPair | undefined {
  return deviceKeyRegistry.get(deviceId);
}

export function registerDeviceKeyPair(deviceId: string, keyPair: KeyPair): void {
  deviceKeyRegistry.set(deviceId, keyPair);
}

export function recordEsp32Heartbeat(
  deviceId: string,
  meta: { rssi?: number; ip?: string; transport?: string; batteryPct?: number; firmwareVersion?: string }
): void {
  deviceHeartbeatRegistry.set(deviceId, {
    lastSeen: getUtcTimestamp(),
    ...meta,
  });
}

export function getEsp32Heartbeat(deviceId: string) {
  return deviceHeartbeatRegistry.get(deviceId);
}

export function getAllEsp32Heartbeats() {
  const out: Record<string, any> = {};
  for (const [k, v] of deviceHeartbeatRegistry.entries()) {
    out[k] = v;
  }
  return out;
}

export async function seedLiveDemoEnvironment(): Promise<void> {
  const db = await getDbClient();

  // First run base seed
  await runSeed(db);

  // Check if demo shipments already exist
  const existingShipments = await db.query('SELECT COUNT(*) as cnt FROM shipments');
  if (Number(existingShipments.rows[0]?.cnt || 0) > 0) {
    return;
  }

  console.log('[DemoSeed] Initializing live localhost cold-chain shipments, batches, and ESP-32 device keys...');

  // 1. Ensure 3rd profile (Insulin Biologics) exists
  const insulinParams = {
    name: 'Humalog Insulin Biologics',
    cargo_type: 'biologics',
    temp_min_c: 2.0,
    temp_max_c: 8.0,
    ref_temp_c: 5.0,
    ref_shelf_life_hours: 500.0,
    activation_energy_j_mol: 85000.0,
    humidity_min_pct: 30.0,
    humidity_max_pct: 65.0,
    max_shock_g: 2.5,
    max_tilt_degrees: 30.0,
  };

  await db.query(
    `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (profile_id, version) DO NOTHING`,
    ['profile-insulin-2-8c', 1, JSON.stringify(insulinParams), 'system-seed', getUtcTimestamp()]
  );

  // 2. Provision Ed25519 keys for ESP-32 fleet devices
  const fleetIds = ['dev-esp32-001', 'dev-esp32-002', 'dev-esp32-003', 'dev-nordic-004'];
  for (const devId of fleetIds) {
    const kp = generateEd25519KeyPair();
    deviceKeyRegistry.set(devId, kp);
    const status = devId === 'dev-nordic-004' ? 'revoked' : 'active';
    await db.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (device_id) DO UPDATE SET public_key = EXCLUDED.public_key, status = EXCLUDED.status`,
      [
        devId,
        'org-frost-demo',
        kp.publicKeyHex,
        status,
        getUtcTimestamp(),
        status === 'revoked' ? getUtcTimestamp() : null,
      ]
    );
  }

  // 3. Create the 3 live shipments with frozen canonical profile hashes
  const shipmentConfigs = [
    {
      shipment_id: 'shipment-vax-amoy-001',
      device_id: 'dev-esp32-001',
      profile_id: 'profile-vaccine-2-8c',
      version: 1,
      status: 'in_transit',
      temps: [4.1, 4.2, 4.3, 4.1, 4.4, 4.2, 4.3, 4.5, 4.2, 4.3],
      humidities: [48.0, 48.2, 48.5, 47.9, 48.4, 48.1, 48.6, 48.3, 48.2, 48.5],
    },
    {
      shipment_id: 'shipment-insulin-002',
      device_id: 'dev-esp32-002',
      profile_id: 'profile-insulin-2-8c',
      version: 1,
      status: 'in_transit',
      temps: [4.5, 5.0, 5.4, 5.9, 6.3, 6.7, 7.1, 7.4, 7.7, 7.9],
      humidities: [52.0, 54.0, 55.5, 57.0, 58.2, 59.0, 60.1, 61.0, 61.5, 62.0],
    },
    {
      shipment_id: 'shipment-produce-003',
      device_id: 'dev-esp32-003',
      profile_id: 'profile-produce-0-4c',
      version: 1,
      status: 'flagged',
      temps: [2.2, 2.4, 2.5, 2.8, 3.4, 5.2, 8.1, 10.6, 12.8, 14.2],
      humidities: [85.0, 84.5, 84.0, 83.0, 82.0, 80.5, 79.5, 79.0, 78.5, 78.0],
    },
  ];

  const baseTimeMs = Date.now() - 10 * 6 * 60 * 1000;

  for (const cfg of shipmentConfigs) {
    const profRes = await db.query(
      'SELECT parameters FROM profiles WHERE profile_id = $1 AND version = $2',
      [cfg.profile_id, cfg.version]
    );
    const rawParams = profRes.rows[0].parameters;
    const parsedParams = typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;
    const profileHash = computeCanonicalHash(parsedParams);

    await db.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash,
        status, start_time, end_time, ai_enabled, ai_email_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, true, true)`,
      [
        cfg.shipment_id,
        cfg.device_id,
        cfg.profile_id,
        cfg.version,
        profileHash,
        cfg.status,
        new Date(baseTimeMs).toISOString(),
      ]
    );

    try {
      await blockchainService.registerShipmentOnChain(
        cfg.shipment_id,
        profileHash,
        Number(parsedParams.temp_min_c),
        Number(parsedParams.temp_max_c)
      );
    } catch {
      // Ignore if already registered
    }

    const kp = deviceKeyRegistry.get(cfg.device_id)!;
    let prevHash = GENESIS_PREV_HASH;

    for (let i = 0; i < cfg.temps.length; i++) {
      const seq = i + 1;
      const readingTs = new Date(baseTimeMs + i * 6 * 60 * 1000).toISOString();
      const payload = {
        readings: [
          {
            timestamp: readingTs,
            temperature: cfg.temps[i],
            humidity: cfg.humidities[i],
            shock_g: cfg.status === 'flagged' && i === 6 ? 3.2 : 0.1,
            tilt_deg: 2.0,
            door_open: false,
            battery_pct: 94,
          },
        ],
      };

      const hash = computeBatchHash({
        device_id: cfg.device_id,
        shipment_id: cfg.shipment_id,
        sequence_no: seq,
        prev_hash: prevHash,
        payload,
      });
      const signature = signWithEd25519(hash, kp.privateKeyHex);
      const batchId = `batch-${cfg.shipment_id}-seq-${seq}`;

      await db.query(
        `INSERT INTO batches (
          batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, signature, payload, received_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          batchId,
          cfg.shipment_id,
          cfg.device_id,
          seq,
          prevHash,
          hash,
          signature,
          JSON.stringify(payload),
          readingTs,
        ]
      );

      prevHash = hash;
      await processBatchDeterministic(batchId, cfg.shipment_id);
      await checkAndCloseBatchWindow(cfg.shipment_id, 5);
    }
  }

  // 4. Seed AI Insights & Benchmark Evaluations in Database
  const insightsToSeed = [
    {
      insight_id: 'ins-001',
      shipment_id: 'shipment-vax-amoy-001',
      kind: 'risk',
      score: 0.185,
      severity: 'info',
      explanation: 'Thermal corridor nominal (4.1°C to 4.5°C). Arrhenius degradation rate standard. Low risk.',
      input_ref: 'batch-shipment-vax-amoy-001-seq-10',
      warmup_status: 'active',
      model_name: 'CompositeRiskScorer',
      model_version: 'v1.0.0',
    },
    {
      insight_id: 'ins-002',
      shipment_id: 'shipment-vax-amoy-001',
      kind: 'anomaly',
      score: 0.12,
      severity: 'info',
      explanation: 'River HalfSpaceTrees streaming anomaly score 0.12 (well below 0.70 threshold).',
      input_ref: 'batch-shipment-vax-amoy-001-seq-10',
      warmup_status: 'active',
      model_name: 'RiverHalfSpaceTrees',
      model_version: 'v1.0.0',
    },
    {
      insight_id: 'ins-003',
      shipment_id: 'shipment-insulin-002',
      kind: 'forecast',
      score: 0.68,
      severity: 'warning',
      explanation: 'Upward thermal trajectory detected. CUSUM positive drift detected (+0.08°C/min). Projected to cross 8.0°C in ~16 minutes.',
      input_ref: 'batch-shipment-insulin-002-seq-10',
      warmup_status: 'active',
      model_name: 'CUSUMDriftDetector',
      model_version: 'v1.0.0',
    },
    {
      insight_id: 'ins-004',
      shipment_id: 'shipment-insulin-002',
      kind: 'risk',
      score: 0.68,
      severity: 'warning',
      explanation: 'ELEVATED risk tier reached. Humidity elevated (62%). Advising pre-emptive refrigeration check before biologic denaturing.',
      input_ref: 'batch-shipment-insulin-002-seq-10',
      warmup_status: 'active',
      model_name: 'CompositeRiskScorer',
      model_version: 'v1.0.0',
    },
    {
      insight_id: 'ins-005',
      shipment_id: 'shipment-produce-003',
      kind: 'anomaly',
      score: 0.94,
      severity: 'critical',
      explanation: 'Severe thermal excursion (14.2°C vs max 4.0°C). HalfSpaceTrees anomaly score 0.94 indicates severe deviation.',
      input_ref: 'batch-shipment-produce-003-seq-10',
      warmup_status: 'active',
      model_name: 'RiverHalfSpaceTrees',
      model_version: 'v1.0.0',
    },
    {
      insight_id: 'ins-006',
      shipment_id: 'shipment-produce-003',
      kind: 'risk',
      score: 0.885,
      severity: 'critical',
      explanation: 'CRITICAL risk tier triggered. Shelf life degraded significantly. Arrhenius velocity accelerated above baseline.',
      input_ref: 'batch-shipment-produce-003-seq-10',
      warmup_status: 'active',
      model_name: 'CompositeRiskScorer',
      model_version: 'v1.0.0',
    },
  ];

  for (const ins of insightsToSeed) {
    await db.query(
      `INSERT INTO ai_insights (
        insight_id, shipment_id, kind, score, severity, explanation,
        input_ref, warmup_status, model_name, model_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (insight_id) DO NOTHING`,
      [
        ins.insight_id,
        ins.shipment_id,
        ins.kind,
        ins.score,
        ins.severity,
        ins.explanation,
        ins.input_ref,
        ins.warmup_status,
        ins.model_name,
        ins.model_version,
        getUtcTimestamp(),
      ]
    );
  }

  const evaluationsToSeed = [
    {
      evaluation_id: 'eval-001',
      model_name: 'River HalfSpaceTrees (Streaming)',
      model_version: 'v1.0.0',
      precision: 0.88,
      recall: 0.94,
      false_alert_rate: 0.04,
      avg_lead_time_seconds: 960,
      dataset_name: 'FrostLedger Historical Excursion Benchmark v1 (N=1,200)',
    },
    {
      evaluation_id: 'eval-002',
      model_name: 'IsolationForest (Batch Baseline)',
      model_version: 'v1.4.2',
      precision: 0.82,
      recall: 0.87,
      false_alert_rate: 0.08,
      avg_lead_time_seconds: 600,
      dataset_name: 'FrostLedger Historical Excursion Benchmark v1 (N=1,200)',
    },
    {
      evaluation_id: 'eval-003',
      model_name: 'LocalOutlierFactor (Density Baseline)',
      model_version: 'v1.4.2',
      precision: 0.79,
      recall: 0.81,
      false_alert_rate: 0.11,
      avg_lead_time_seconds: 480,
      dataset_name: 'FrostLedger Historical Excursion Benchmark v1 (N=1,200)',
    },
  ];

  for (const ev of evaluationsToSeed) {
    await db.query(
      `INSERT INTO ai_evaluations (
        evaluation_id, model_name, model_version, precision, recall,
        false_alert_rate, avg_lead_time_seconds, dataset_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (evaluation_id) DO NOTHING`,
      [
        ev.evaluation_id,
        ev.model_name,
        ev.model_version,
        ev.precision,
        ev.recall,
        ev.false_alert_rate,
        ev.avg_lead_time_seconds,
        ev.dataset_name,
        getUtcTimestamp(),
      ]
    );
  }

  // 5. Seed initial audit log entries
  await writeAuditLog('system-arrival-verifier', 'VERIFY_ARRIVAL', 'shipment:shipment-vax-amoy-001');
  await writeAuditLog('polygon-amoy-worker', 'ANCHOR_BATCH_TX', 'shipment:shipment-vax-amoy-001');
  await writeAuditLog('admin@coldchain.test', 'key_revocation', 'device:dev-nordic-004');

  console.log('[DemoSeed] Live demo shipments, cryptographic batches, and ESP-32 fleet keys initialized.');
}
