import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDbClient } from '../db';
import {
  TelemetrySubmissionSchema,
  EventSubmissionSchema,
  createErrorResponse,
} from '@frostledger/shared';
import { validateBody } from '../middleware/validate';
import { authenticateWebhook } from '../middleware/webhookAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ingestTelemetryBatch, TelemetryIngestError } from '../services/telemetryService';

const router = Router();

/**
 * POST /telemetry
 * Ingests signed batches forwarded by MQTT broker webhook or HTTP clients.
 */
router.post(
  '/telemetry',
  authenticateWebhook,
  validateBody(TelemetrySubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await ingestTelemetryBatch(req.body);
      if (result.status === 'duplicate') {
        return res.status(200).json({
          message: 'Duplicate batch ignored without error (idempotent)',
          batch_id: result.batch_id,
          sequence_no: result.sequence_no,
          status: 'duplicate',
        });
      }

      return res.status(201).json({
        message: 'Batch accepted and stored successfully',
        batch_id: result.batch_id,
        sequence_no: result.sequence_no,
        status: 'accepted',
        received_at: result.received_at,
      });
    } catch (err: any) {
      if (err instanceof TelemetryIngestError) {
        return res.status(err.status).json(createErrorResponse(err.code, err.message));
      }
      throw err;
    }
  })
);

/**
 * GET /telemetry/live/:shipmentId
 * Returns chronological sensor readings and batch trail directly from PostgreSQL DB.
 */
router.get(
  '/telemetry/live/:shipmentId',
  asyncHandler(async (req: Request, res: Response) => {
    const { shipmentId } = req.params;
    const db = await getDbClient();

    const batchesRes = await db.query(
      `SELECT batch_id, sequence_no, prev_hash, hash, signature, payload, received_at
       FROM batches
       WHERE shipment_id = $1
       ORDER BY sequence_no ASC`,
      [shipmentId]
    );

    const readings: any[] = [];
    for (const b of batchesRes.rows) {
      const p = typeof b.payload === 'string' ? JSON.parse(b.payload) : b.payload;
      if (p.readings) {
        for (const r of p.readings) {
          readings.push({
            sequence_no: Number(b.sequence_no),
            batch_id: b.batch_id,
            timestamp: r.timestamp ? r.timestamp.substring(11, 19) : '00:00:00',
            full_timestamp: r.timestamp,
            temperature: Number(r.temperature),
            humidity: Number(r.humidity),
            shock: r.shock_events && r.shock_events.length > 0 ? Number(r.shock_events[0].magnitude_g) : 0,
            speed: r.gps?.speed || 45.0,
            hash: b.hash,
            signature: b.signature,
            received_at: b.received_at,
          });
        }
      }
    }

    return res.json({
      shipment_id: shipmentId,
      batch_count: batchesRes.rowCount,
      readings,
    });
  })
);

/**
 * GET /telemetry/resume/:deviceId
 * Returns the latest recorded batch for a device to allow seamless auto-resumption
 * without sequence number collisions or broken hash chains.
 */
router.get(
  ['/telemetry/resume/:deviceId', '/telemetry/device/:deviceId/last'],
  asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const db = await getDbClient();

    const lastBatchRes = await db.query(
      `SELECT batch_id, shipment_id, device_id, sequence_no, hash, received_at
       FROM batches
       WHERE device_id = $1
       ORDER BY sequence_no DESC
       LIMIT 1`,
      [deviceId]
    );

    const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

    if (lastBatchRes.rowCount === 0) {
      return res.json({
        device_id: deviceId,
        last_sequence_no: 0,
        next_sequence_no: 1,
        last_hash: GENESIS_HASH,
        has_history: false,
      });
    }

    const last = lastBatchRes.rows[0];
    return res.json({
      device_id: deviceId,
      shipment_id: last.shipment_id,
      batch_id: last.batch_id,
      last_sequence_no: Number(last.sequence_no),
      next_sequence_no: Number(last.sequence_no) + 1,
      last_hash: last.hash,
      received_at: last.received_at,
      has_history: true,
    });
  })
);

/**
 * POST /events
 * Ingests physical handling events (shock, tilt, door-open)
 */
router.post(
  '/events',
  authenticateWebhook,
  validateBody(EventSubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { event_id, shipment_id, type, magnitude, timestamp } = req.body;
    const db = await getDbClient();

    const finalEventId = event_id || `evt-${crypto.randomUUID()}`;

    await db.query(
      `INSERT INTO events (event_id, shipment_id, type, magnitude, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [finalEventId, shipment_id, type, magnitude, timestamp]
    );

    return res.status(201).json({
      message: 'Event recorded successfully',
      event_id: finalEventId,
      shipment_id,
      type,
      magnitude,
      timestamp,
    });
  })
);

export default router;
