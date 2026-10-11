import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { getDbClient } from '../db';
import {
  ADVISORY_LABEL,
  computeBatchHash,
  computeCanonicalHash,
  createErrorResponse,
  generateEd25519KeyPair,
  GENESIS_PREV_HASH,
  getUtcTimestamp,
  signWithEd25519,
} from '@frostledger/shared';
import { asyncHandler } from '../middleware/asyncHandler';
import { processBatchDeterministic } from '../services/deterministicCore';
import { checkAndCloseBatchWindow } from '../services/blockchainService';
import { writeAuditLog } from '../services/auditService';
import { createSecurityAlert } from '../services/alertService';
import {
  getAllEsp32Heartbeats,
  getDeviceKeyPair,
  recordEsp32Heartbeat,
  registerDeviceKeyPair,
} from '../db/demoSeed';

const router = Router();

/**
 * GET /dashboard/state
 * Returns complete live state for the FrostLedger Console Dashboard
 */
router.get(
  '/dashboard/state',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = await getDbClient();

    // 1. Fetch shipments joined with profiles
    const shipmentsRes = await db.query(`
      SELECT s.shipment_id, s.device_id, s.profile_id, s.profile_version, s.profile_hash,
             s.status, s.start_time, s.end_time, s.ai_enabled, p.parameters
      FROM shipments s
      JOIN profiles p ON s.profile_id = p.profile_id AND s.profile_version = p.version
      ORDER BY s.start_time ASC
    `);

    // 2. Fetch all batches ordered by sequence_no
    const batchesRes = await db.query(`
      SELECT batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, signature, payload, received_at
      FROM batches
      ORDER BY sequence_no ASC
    `);

    // 3. Fetch shelf_life_trail
    const trailRes = await db.query(`
      SELECT shipment_id, batch_id, mkt, consumed_fraction, remaining_life, created_at
      FROM shelf_life_trail
      ORDER BY created_at ASC
    `);

    // 4. Fetch anchors
    const anchorsRes = await db.query(`
      SELECT a.batch_id, a.tx_hash, a.status, a.anchored_at, b.shipment_id
      FROM anchors a
      JOIN batches b ON a.batch_id = b.batch_id
      WHERE a.status = 'anchored' AND a.tx_hash IS NOT NULL
      ORDER BY a.anchored_at DESC
    `);

    // 5. Fetch alerts
    const alertsRes = await db.query(`
      SELECT alert_id, shipment_id, type, severity, source, acknowledged_by, note, created_at
      FROM alerts
      ORDER BY created_at DESC
    `);

    // 6. Fetch AI insights
    const insightsRes = await db.query(`
      SELECT insight_id, shipment_id, kind, score, severity, explanation,
             input_ref, warmup_status, model_name, model_version, created_at
      FROM ai_insights
      ORDER BY created_at DESC
    `);

    // 7. Fetch AI evaluations
    const evalsRes = await db.query(`
      SELECT evaluation_id, model_name, model_version, precision,
             recall, false_alert_rate, avg_lead_time_seconds, dataset_name, created_at
      FROM ai_evaluations
      ORDER BY created_at DESC
    `);

    // 8. Fetch devices
    const devicesRes = await db.query(`
      SELECT device_id, public_key, status, created_at, revoked_at
      FROM devices
      ORDER BY device_id ASC
    `);

    // 9. Fetch profiles
    const profilesRes = await db.query(`
      SELECT p.profile_id, p.version, p.parameters, p.created_by, p.created_at
      FROM profiles p
      INNER JOIN (
        SELECT profile_id, MAX(version) as max_v
        FROM profiles
        GROUP BY profile_id
      ) latest ON p.profile_id = latest.profile_id AND p.version = latest.max_v
      ORDER BY p.profile_id ASC
    `);

    // 10. Fetch audit logs
    const auditRes = await db.query(`
      SELECT log_id, actor, action, target, timestamp
      FROM audit_log
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    // Group batches by shipment
    const telemetryByShipment: Record<string, any[]> = {};
    const latestReadingByShipment: Record<string, { temp: number; hum: number; ts: string; battery?: number }> = {};
    const batchCountByDevice: Record<string, number> = {};

    for (const b of batchesRes.rows) {
      const sid = b.shipment_id;
      if (!telemetryByShipment[sid]) telemetryByShipment[sid] = [];
      batchCountByDevice[b.device_id] = (batchCountByDevice[b.device_id] || 0) + 1;

      const payload = typeof b.payload === 'string' ? JSON.parse(b.payload) : b.payload;
      const readings = payload?.readings || [];
      for (const r of readings) {
        const iso = typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString();
        const timeLabel = iso.length >= 19 ? iso.substring(11, 19) : iso;
        telemetryByShipment[sid].push({
          timestamp: timeLabel,
          temperature: Number(Number(r.temperature).toFixed(2)),
          humidity: Number(Number(r.humidity ?? 50).toFixed(1)),
          shock: Number(r.shock_g ?? 0),
          speed: 45,
          sequence_no: Number(b.sequence_no),
          batch_hash: b.hash,
        });
        latestReadingByShipment[sid] = {
          temp: Number(r.temperature),
          hum: Number(r.humidity ?? 50),
          ts: iso,
          battery: r.battery_pct,
        };
      }
    }

    // Group latest trail by shipment
    const latestTrailByShipment: Record<string, { mkt: number; consumed: number; remaining: number }> = {};
    for (const t of trailRes.rows) {
      latestTrailByShipment[t.shipment_id] = {
        mkt: Number(t.mkt),
        consumed: Number(t.consumed_fraction),
        remaining: Number(t.remaining_life),
      };
    }

    // Group latest anchor by shipment
    const latestTxByShipment: Record<string, string> = {};
    for (const a of anchorsRes.rows) {
      if (!latestTxByShipment[a.shipment_id]) {
        latestTxByShipment[a.shipment_id] = a.tx_hash;
      }
    }

    // Group alerts by shipment
    const alertsByShipment: Record<string, any[]> = {};
    for (const al of alertsRes.rows) {
      if (!alertsByShipment[al.shipment_id]) alertsByShipment[al.shipment_id] = [];
      alertsByShipment[al.shipment_id].push({
        alert_id: al.alert_id,
        shipment_id: al.shipment_id,
        type: al.type,
        severity: al.severity,
        source: al.source,
        acknowledged_by: al.acknowledged_by,
        note: al.note,
        created_at: typeof al.created_at === 'string' ? al.created_at : al.created_at.toISOString(),
      });
    }

    // Group AI insights by shipment
    const aiInsightsByShipment: Record<string, any[]> = {};
    for (const ins of insightsRes.rows) {
      if (!aiInsightsByShipment[ins.shipment_id]) aiInsightsByShipment[ins.shipment_id] = [];
      const rawScore = Number(ins.score);
      const displayScore = ins.kind === 'risk' || ins.kind === 'forecast'
        ? (rawScore <= 1 ? Number((rawScore * 100).toFixed(1)) : rawScore)
        : rawScore;
      aiInsightsByShipment[ins.shipment_id].push({
        insight_id: ins.insight_id,
        kind: ins.kind,
        score: displayScore,
        severity: ins.severity,
        explanation: ins.explanation,
        input_ref: ins.input_ref,
        warmup_status: ins.warmup_status,
        model_name: ins.model_name,
        model_version: ins.model_version,
        created_at: (typeof ins.created_at === 'string' ? ins.created_at : ins.created_at.toISOString())
          .replace('T', ' ')
          .substring(0, 19),
        label: ADVISORY_LABEL,
      });
    }

    // Build ShipmentSummary list
    const shipments = shipmentsRes.rows.map((s) => {
      const params = typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters;
      const latest = latestReadingByShipment[s.shipment_id] || {
        temp: (Number(params.temp_min_c) + Number(params.temp_max_c)) / 2,
        hum: 50,
        ts: getUtcTimestamp(),
      };
      const trail = latestTrailByShipment[s.shipment_id] || {
        mkt: latest.temp,
        consumed: 0.016,
        remaining: Number(params.ref_shelf_life_hours || 720) * 0.984,
      };
      const remainingPct = Math.max(0, Math.min(100, Number(((1 - trail.consumed) * 100).toFixed(1))));

      // Compute dynamic AI risk score from latest temp & insights
      const tempMin = Number(params.temp_min_c ?? 2.0);
      const tempMax = Number(params.temp_max_c ?? 8.0);
      let riskScore = 18.5;
      if (latest.temp > tempMax) {
        riskScore = Math.min(99, Number((70 + (latest.temp - tempMax) * 3.5).toFixed(1)));
      } else if (latest.temp < tempMin) {
        riskScore = Math.min(99, Number((70 + (tempMin - latest.temp) * 5.0).toFixed(1)));
      } else if (latest.temp > tempMax - 0.5) {
        riskScore = 68.0;
      }

      let riskTier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' = 'LOW';
      if (riskScore >= 75) riskTier = 'CRITICAL';
      else if (riskScore >= 50) riskTier = 'ELEVATED';
      else if (riskScore >= 25) riskTier = 'MODERATE';

      // Check if any unacknowledged critical alerts exist
      const hasCriticalAlert = (alertsByShipment[s.shipment_id] || []).some(
        (a) => a.severity === 'critical' && !a.acknowledged_by
      );
      const effectiveStatus =
        hasCriticalAlert || latest.temp > tempMax || latest.temp < tempMin ? 'flagged' : s.status;

      return {
        shipment_id: s.shipment_id,
        device_id: s.device_id,
        profile_id: s.profile_id,
        profile_name: params.name || s.profile_id,
        cargo_type: String(params.cargo_type || 'vaccine').replace('pharma-', '').replace('fresh-', ''),
        status: effectiveStatus,
        temp_min_c: tempMin,
        temp_max_c: tempMax,
        current_temp: Number(latest.temp.toFixed(2)),
        current_humidity: Number(latest.hum.toFixed(1)),
        mkt: Number(trail.mkt.toFixed(2)),
        remaining_life_pct: remainingPct,
        anchored_tx: latestTxByShipment[s.shipment_id] || null,
        ai_enabled: Boolean(s.ai_enabled),
        ai_risk_score: riskScore,
        ai_risk_tier: riskTier,
      };
    });

    const heartbeats = getAllEsp32Heartbeats();

    const devices = devicesRes.rows.map((d) => {
      const hb = heartbeats[d.device_id];
      return {
        device_id: d.device_id,
        public_key: d.public_key,
        firmware_version: hb?.firmwareVersion || (d.device_id === 'dev-nordic-004' ? 'v2.4.0' : 'v2.4.1-amoy'),
        battery_pct: hb?.batteryPct ?? (d.status === 'revoked' ? 0 : 94),
        last_heartbeat: hb?.lastSeen
          ? `Live (${hb.transport || 'HTTP'}) ${hb.lastSeen.substring(11, 19)} UTC`
          : d.status === 'revoked'
          ? 'Revoked'
          : 'Active (Seeded)',
        status: d.status,
      };
    });

    const profiles = profilesRes.rows.map((p) => {
      const params = typeof p.parameters === 'string' ? JSON.parse(p.parameters) : p.parameters;
      const hash = computeCanonicalHash(params);
      return {
        profile_id: p.profile_id,
        name: params.name || p.profile_id,
        cargo_type: String(params.cargo_type || 'vaccine').replace('pharma-', '').replace('fresh-', ''),
        temp_min_c: Number(params.temp_min_c ?? 2.0),
        temp_max_c: Number(params.temp_max_c ?? 8.0),
        max_excursion_seconds: Number(params.max_excursion_seconds ?? 7200),
        mkt_activation_energy_kj: Number(((params.activation_energy_j_mol ?? 83144) / 1000).toFixed(3)),
        version: Number(p.version),
        profile_hash: hash,
        created_at: typeof p.created_at === 'string' ? p.created_at : p.created_at.toISOString(),
      };
    });

    const auditLogs = auditRes.rows.map((a) => {
      const [targetTable, recordId] = String(a.target || 'system:global').split(':');
      return {
        log_id: a.log_id,
        timestamp: (typeof a.timestamp === 'string' ? a.timestamp : a.timestamp.toISOString())
          .replace('T', ' ')
          .substring(0, 19),
        actor: a.actor,
        action: String(a.action).toUpperCase(),
        target_table: targetTable || 'system',
        record_id: recordId || a.target,
        details: `Verified action '${a.action}' by ${a.actor} on ${a.target}`,
      };
    });

    const evaluations = evalsRes.rows.map((ev) => ({
      evaluation_id: ev.evaluation_id,
      model_name: ev.model_name,
      model_version: ev.model_version,
      precision: Number(ev.precision),
      recall: Number(ev.recall),
      false_alert_rate: Number(ev.false_alert_rate),
      avg_lead_time_seconds: Number(ev.avg_lead_time_seconds),
      dataset_name: ev.dataset_name,
      created_at: (typeof ev.created_at === 'string' ? ev.created_at : ev.created_at.toISOString())
        .replace('T', ' ')
        .substring(0, 19),
      label: ADVISORY_LABEL,
    }));

    return res.json({
      status: 'ok',
      timestamp: getUtcTimestamp(),
      shipments,
      telemetryByShipment,
      alertsByShipment,
      aiInsightsByShipment,
      evaluations,
      devices,
      profiles,
      auditLogs,
      esp32Heartbeats: heartbeats,
    });
  })
);

/**
 * POST /dashboard/alerts/:id/acknowledge
 * Acknowledges an official alert in PostgreSQL and writes an immutable audit log entry.
 */
router.post(
  '/dashboard/alerts/:id/acknowledge',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const note = String(req.body?.note || 'Acknowledged via FrostLedger Console').trim();
    const actor = String(req.body?.actor || 'operator@coldchain.test');
    const db = await getDbClient();

    const alertRes = await db.query('SELECT alert_id FROM alerts WHERE alert_id = $1', [id]);
    if (alertRes.rowCount === 0) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', `Alert '${id}' not found`));
    }

    await db.query('UPDATE alerts SET acknowledged_by = $1, note = $2 WHERE alert_id = $3', [
      actor,
      note,
      id,
    ]);
    await writeAuditLog(actor, 'alert_acknowledgement', `alerts:${id}`);

    return res.json({
      status: 'acknowledged',
      alert_id: id,
      acknowledged_by: actor,
      note,
    });
  })
);

/**
 * POST /dashboard/devices/:id/revoke
 * Revokes an Ed25519 device key in PostgreSQL and records an immutable audit log entry.
 */
router.post(
  '/dashboard/devices/:id/revoke',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const actor = String(req.body?.actor || 'admin@coldchain.test');
    const db = await getDbClient();

    const devRes = await db.query('SELECT device_id FROM devices WHERE device_id = $1', [id]);
    if (devRes.rowCount === 0) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', `Device '${id}' not found`));
    }

    const revokedAt = getUtcTimestamp();
    await db.query('UPDATE devices SET status = $1, revoked_at = $2 WHERE device_id = $3', [
      'revoked',
      revokedAt,
      id,
    ]);
    await writeAuditLog(actor, 'REVOKE_DEVICE_KEY', `devices:${id}`);

    return res.json({
      status: 'revoked',
      device_id: id,
      revoked_at: revokedAt,
    });
  })
);

/**
 * POST /dashboard/profiles
 * Creates a new immutable product profile version in PostgreSQL with canonical SHA-256 hash.
 */
router.post(
  '/dashboard/profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      name,
      cargo_type,
      temp_min_c,
      temp_max_c,
      max_excursion_seconds,
      mkt_activation_energy_kj,
    } = req.body;
    const actor = String(req.body?.actor || 'admin@coldchain.test');
    const db = await getDbClient();

    const slug = String(name || 'custom')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const profileId = req.body.profile_id || `profile-${slug}`;

    const versionRes = await db.query(
      'SELECT COALESCE(MAX(version), 0) AS max_version FROM profiles WHERE profile_id = $1',
      [profileId]
    );
    const newVersion = Number(versionRes.rows[0].max_version) + 1;

    const parameters = {
      name: String(name || profileId),
      cargo_type: String(cargo_type || 'vaccine'),
      temp_min_c: Number(temp_min_c ?? 2.0),
      temp_max_c: Number(temp_max_c ?? 8.0),
      ref_temp_c: (Number(temp_min_c ?? 2.0) + Number(temp_max_c ?? 8.0)) / 2,
      ref_shelf_life_hours: 720.0,
      activation_energy_j_mol: Number(mkt_activation_energy_kj ?? 83.144) * 1000,
      max_excursion_seconds: Number(max_excursion_seconds ?? 7200),
      humidity_min_pct: 20.0,
      humidity_max_pct: 80.0,
      max_shock_g: 3.0,
      max_tilt_degrees: 45.0,
    };

    const profileHash = computeCanonicalHash(parameters);
    const createdAt = getUtcTimestamp();

    await db.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [profileId, newVersion, JSON.stringify(parameters), actor, createdAt]
    );

    await writeAuditLog(actor, 'REGISTER_PROFILE', `profiles:${profileId}:v${newVersion}`);

    return res.status(201).json({
      profile: {
        profile_id: profileId,
        name: parameters.name,
        cargo_type: parameters.cargo_type,
        temp_min_c: parameters.temp_min_c,
        temp_max_c: parameters.temp_max_c,
        max_excursion_seconds: parameters.max_excursion_seconds,
        mkt_activation_energy_kj: Number((parameters.activation_energy_j_mol / 1000).toFixed(3)),
        version: newVersion,
        profile_hash: profileHash,
        created_at: createdAt,
      },
    });
  })
);

/**
 * GET /esp32/status
 * Checks connected USB Serial COM ports on the host machine and active ESP-32 Wi-Fi/Serial heartbeats.
 */
router.get(
  '/esp32/status',
  asyncHandler(async (_req: Request, res: Response) => {
    let comPorts: string[] = [];
    if (process.platform === 'win32') {
      try {
        const raw = execSync(
          'powershell.exe -NoProfile -Command "[System.IO.Ports.SerialPort]::GetPortNames() -join \',\'"',
          { timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }
        )
          .toString()
          .trim();
        if (raw) {
          comPorts = raw.split(',').map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        comPorts = [];
      }
    }

    const heartbeats = getAllEsp32Heartbeats();
    const activeDevices = Object.keys(heartbeats);

    return res.json({
      status: 'ok',
      timestamp: getUtcTimestamp(),
      host_com_ports: comPorts,
      hardware_usb_detected: comPorts.length > 0,
      active_esp32_streams: activeDevices.length,
      heartbeats,
      endpoints: {
        http_ingest: '/esp32/ingest',
        signed_webhook: '/telemetry',
      },
    });
  })
);

/**
 * POST /esp32/ingest
 * Live ESP-32 Telemetry Ingestion Gateway (supports both Wi-Fi HTTP POST from ESP-32 firmware
 * and Web Serial USB bridge from the browser).
 * Performs:
 *  - Device lookup & revocation enforcement
 *  - Automatic sequence_no and prev_hash chaining
 *  - RFC-8785 Canonical JSON SHA-256 batch hashing & Ed25519 signing
 *  - Full deterministic Arrhenius MKT, shelf-life, and threshold alert processing
 *  - Window blockchain anchoring
 */
router.post(
  '/esp32/ingest',
  asyncHandler(async (req: Request, res: Response) => {
    const db = await getDbClient();
    const device_id = String(req.body?.device_id || 'dev-esp32-001');
    const shipment_id = String(req.body?.shipment_id || 'shipment-vax-amoy-001');
    const temperature = Number(req.body?.temperature ?? 4.2);
    const humidity = Number(req.body?.humidity ?? 48.5);
    const shock_g = Number(req.body?.shock_g ?? 0.1);
    const tilt_deg = Number(req.body?.tilt_deg ?? 1.5);
    const door_open = Boolean(req.body?.door_open ?? false);
    const battery_pct = Number(req.body?.battery_pct ?? 95);
    const transport = String(req.body?.transport || 'wifi-http');
    const firmware_version = String(req.body?.firmware_version || 'v2.5.0-esp32');

    // 1. Check device in DB (or auto-provision if it's a new ESP32 connecting for the first time)
    let deviceRes = await db.query(
      'SELECT device_id, public_key, status FROM devices WHERE device_id = $1',
      [device_id]
    );

    let keyPair = getDeviceKeyPair(device_id);
    if (deviceRes.rowCount === 0) {
      keyPair = generateEd25519KeyPair();
      registerDeviceKeyPair(device_id, keyPair);
      await db.query(
        `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
         VALUES ($1, $2, $3, 'active', $4)`,
        [device_id, 'org-frost-demo', keyPair.publicKeyHex, getUtcTimestamp()]
      );
      deviceRes = await db.query(
        'SELECT device_id, public_key, status FROM devices WHERE device_id = $1',
        [device_id]
      );
    } else if (!keyPair) {
      // Ensure a live signing keypair matches the device if server was restarted
      keyPair = generateEd25519KeyPair();
      registerDeviceKeyPair(device_id, keyPair);
      await db.query('UPDATE devices SET public_key = $1 WHERE device_id = $2', [
        keyPair.publicKeyHex,
        device_id,
      ]);
    }

    const device = deviceRes.rows[0];
    if (device.status === 'revoked') {
      await createSecurityAlert(
        shipment_id,
        'revoked_device',
        'critical',
        `ESP-32 telemetry rejected from revoked device: ${device_id}`
      );
      return res
        .status(403)
        .json(createErrorResponse('DEVICE_REVOKED', `Device '${device_id}' has been revoked`));
    }

    // 2. Determine next sequence_no and prev_hash for this device
    const lastBatchRes = await db.query(
      'SELECT sequence_no, hash FROM batches WHERE device_id = $1 ORDER BY sequence_no DESC LIMIT 1',
      [device_id]
    );

    const sequence_no =
      lastBatchRes.rowCount === 0 ? 1 : Number(lastBatchRes.rows[0].sequence_no) + 1;
    const prev_hash =
      lastBatchRes.rowCount === 0 ? GENESIS_PREV_HASH : String(lastBatchRes.rows[0].hash);

    const readingTimestamp = getUtcTimestamp();
    const payload = {
      readings: [
        {
          timestamp: readingTimestamp,
          temperature,
          humidity,
          shock_g,
          tilt_deg,
          door_open,
          battery_pct,
        },
      ],
    };

    // 3. Compute canonical SHA-256 batch hash & Ed25519 signature
    const hash = computeBatchHash({
      device_id,
      shipment_id,
      sequence_no,
      prev_hash,
      payload,
    });
    const signature = signWithEd25519(hash, keyPair.privateKeyHex);
    const batchId = `batch-${shipment_id}-seq-${sequence_no}-${crypto.randomUUID().slice(0, 6)}`;

    // 4. Insert into batches
    await db.query(
      `INSERT INTO batches (
        batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, signature, payload, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        batchId,
        shipment_id,
        device_id,
        sequence_no,
        prev_hash,
        hash,
        signature,
        JSON.stringify(payload),
        readingTimestamp,
      ]
    );

    // 5. Run deterministic engine (Arrhenius MKT, shelf-life trail, threshold alerts)
    const detResult = await processBatchDeterministic(batchId, shipment_id);
    if (detResult.alertsCreated.length > 0) {
      await db.query(`UPDATE shipments SET status = 'flagged' WHERE shipment_id = $1`, [
        shipment_id,
      ]);
    }

    // 6. Check and close 5-batch window for on-chain anchoring
    const anchorResult = await checkAndCloseBatchWindow(shipment_id, 5);

    // 7. Record live ESP-32 heartbeat
    recordEsp32Heartbeat(device_id, {
      ip: req.ip,
      transport,
      batteryPct: battery_pct,
      firmwareVersion: firmware_version,
    });

    return res.status(201).json({
      status: 'accepted',
      batch_id: batchId,
      shipment_id,
      device_id,
      sequence_no,
      prev_hash,
      hash,
      signature,
      mkt_celsius: Number(detResult.mktCelsius.toFixed(2)),
      remaining_life_hours: Number(detResult.remainingLifeHours.toFixed(2)),
      alerts_triggered: detResult.alertsCreated.length,
      anchored_tx: anchorResult?.txHash || null,
      received_at: readingTimestamp,
    });
  })
);

export default router;
