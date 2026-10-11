import { Router, Response } from 'express';
import { getDbClient } from '../db';
import { ADVISORY_LABEL, createErrorResponse } from '@frostledger/shared';
import { authenticateJwt, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

/**
 * GET /ai/insights/:shipmentId
 * Retrieves AI-generated streaming anomaly and drift insights for a shipment.
 * Strictly advisory - mandatory label attached.
 */
router.get(
  '/insights/:shipmentId',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shipmentId } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const db = await getDbClient();

    // Verify shipment exists
    const shipmentRes = await db.query(
      'SELECT shipment_id, ai_enabled FROM shipments WHERE shipment_id = $1',
      [shipmentId]
    );

    if (shipmentRes.rowCount === 0) {
      return res
        .status(404)
        .json(createErrorResponse('SHIPMENT_NOT_FOUND', `Shipment '${shipmentId}' does not exist`));
    }

    const querySql = `
      SELECT insight_id, shipment_id, kind, score, severity, explanation,
             input_ref, warmup_status, model_name, model_version, created_at
      FROM ai_insights
      WHERE shipment_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await db.query(querySql, [shipmentId, limit]);

    const formattedInsights = result.rows.map((row) => ({
      insight_id: row.insight_id,
      shipment_id: row.shipment_id,
      kind: row.kind,
      score: Number(row.score),
      severity: row.severity,
      explanation: row.explanation,
      input_ref: row.input_ref,
      warmup_status: row.warmup_status,
      model_name: row.model_name,
      model_version: row.model_version,
      created_at: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
      label: ADVISORY_LABEL,
    }));

    return res.json({
      shipmentId,
      ai_enabled: shipmentRes.rows[0].ai_enabled,
      label: ADVISORY_LABEL,
      count: formattedInsights.length,
      insights: formattedInsights,
    });
  })
);

/**
 * GET /ai/status/:shipmentId
 * Returns current online model learning state & warmup status for a shipment.
 */
router.get(
  '/status/:shipmentId',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shipmentId } = req.params;
    const db = await getDbClient();

    const stateRes = await db.query(
      'SELECT shipment_id, model_version, state, last_batch_id, updated_at FROM ai_model_state WHERE shipment_id = $1',
      [shipmentId]
    );

    if (stateRes.rowCount === 0) {
      return res.json({
        shipmentId,
        label: ADVISORY_LABEL,
        model_status: 'uninitialized',
        message: 'No online model state checkpoint found for this shipment yet.',
      });
    }

    const row = stateRes.rows[0];
    const parsedState = typeof row.state === 'string' ? JSON.parse(row.state) : row.state;

    return res.json({
      shipmentId,
      label: ADVISORY_LABEL,
      model_version: row.model_version,
      last_batch_id: row.last_batch_id,
      warmup_status: parsedState.sample_count < (parsedState.warmup_samples || 30) ? 'warming_up' : 'active',
      sample_count: parsedState.sample_count || 0,
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString(),
    });
  })
);

/**
 * GET /ai/risk/:shipmentId
 * Returns the latest multi-dimensional composite risk assessment for a shipment.
 * Strictly advisory.
 */
router.get(
  '/risk/:shipmentId',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shipmentId } = req.params;
    const db = await getDbClient();

    // Verify shipment exists
    const shipmentRes = await db.query(
      `SELECT s.shipment_id, s.profile_id, s.profile_version, p.parameters
       FROM shipments s
       JOIN profiles p ON s.profile_id = p.profile_id AND s.profile_version = p.version
       WHERE s.shipment_id = $1`,
      [shipmentId]
    );

    if (shipmentRes.rowCount === 0) {
      return res
        .status(404)
        .json(createErrorResponse('SHIPMENT_NOT_FOUND', `Shipment '${shipmentId}' does not exist`));
    }

    const profileParams = shipmentRes.rows[0].parameters || {};
    const tempMin = Number(profileParams.temp_min_c ?? 2.0);
    const tempMax = Number(profileParams.temp_max_c ?? 8.0);

    // 1. Check if a recent risk insight exists in ai_insights
    const riskInsightRes = await db.query(
      `SELECT insight_id, score, severity, explanation, created_at
       FROM ai_insights
       WHERE shipment_id = $1 AND kind = 'risk'
       ORDER BY created_at DESC
       LIMIT 1`,
      [shipmentId]
    );

    // 2. Fetch latest telemetry reading to compute baseline risk factors
    const latestBatchRes = await db.query(
      `SELECT payload, received_at FROM batches WHERE shipment_id = $1 ORDER BY sequence_no DESC LIMIT 1`,
      [shipmentId]
    );

    let latestTemp = (tempMin + tempMax) / 2.0;
    if (latestBatchRes.rowCount > 0) {
      const readings = latestBatchRes.rows[0].payload?.readings || [];
      if (readings.length > 0) {
        latestTemp = Number(readings[readings.length - 1].temperature ?? latestTemp);
      }
    }

    let compositeScore = 15.0;
    let tier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' = 'LOW';
    let thermalRisk = 10.0;
    let anomalyRisk = 10.0;
    let driftRisk = 5.0;
    let kineticsRisk = 5.0;
    let securityPenalty = 0.0;
    let explanation = `Normal operating conditions at ${latestTemp.toFixed(2)}°C.`;
    let recommendation = 'Standard cold chain monitoring. No action required.';
    let evaluatedAt = new Date().toISOString();

    if (riskInsightRes.rowCount > 0) {
      const ins = riskInsightRes.rows[0];
      compositeScore = Math.round(Number(ins.score) * 100);
      explanation = ins.explanation;
      evaluatedAt = typeof ins.created_at === 'string' ? ins.created_at : ins.created_at.toISOString();
    } else {
      // Dynamic baseline computation from latest telemetry
      if (latestTemp > tempMax) {
        const excess = latestTemp - tempMax;
        thermalRisk = Math.min(100, 25 + excess * 20);
        compositeScore = Math.min(100, 0.4 * thermalRisk + 20);
      } else if (latestTemp < tempMin) {
        const deficit = tempMin - latestTemp;
        thermalRisk = Math.min(100, latestTemp <= 0 && tempMin >= 0 ? 100 : 30 + deficit * 25);
        compositeScore = Math.min(100, 0.4 * thermalRisk + 20);
      }
    }

    // Determine tier
    if (compositeScore >= 75) {
      tier = 'CRITICAL';
      recommendation = 'Imminent breach or tamper detected. Immediate operational intervention required.';
    } else if (compositeScore >= 50) {
      tier = 'ELEVATED';
      recommendation = 'Significant thermal drift or anomaly. Inspect refrigeration container.';
    } else if (compositeScore >= 25) {
      tier = 'MODERATE';
      recommendation = 'Minor temperature variation detected. Continue observation.';
    } else {
      tier = 'LOW';
      recommendation = 'Shipment conditions optimal. Continue normal scheduled monitoring.';
    }

    return res.json({
      shipmentId,
      label: ADVISORY_LABEL,
      compositeRiskScore: compositeScore,
      tier,
      factors: {
        thermalRisk,
        anomalyRisk,
        driftRisk,
        kineticsRisk,
        securityPenalty,
      },
      explanation,
      recommendation,
      lastEvaluatedAt: evaluatedAt,
    });
  })
);

/**
 * GET /ai/notifications/:shipmentId
 * Retrieves audit log of AI advisory notifications sent/suppressed.
 */
router.get(
  '/notifications/:shipmentId',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shipmentId } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const db = await getDbClient();

    // Verify shipment exists
    const shipmentRes = await db.query(
      'SELECT shipment_id FROM shipments WHERE shipment_id = $1',
      [shipmentId]
    );

    if (shipmentRes.rowCount === 0) {
      return res
        .status(404)
        .json(createErrorResponse('SHIPMENT_NOT_FOUND', `Shipment '${shipmentId}' does not exist`));
    }

    const result = await db.query(
      `SELECT notification_id, insight_id, shipment_id, sent_at, status
       FROM ai_notifications
       WHERE shipment_id = $1
       ORDER BY sent_at DESC
       LIMIT $2`,
      [shipmentId, limit]
    );

    const formattedNotifications = result.rows.map((row) => ({
      notification_id: row.notification_id,
      insight_id: row.insight_id,
      shipment_id: row.shipment_id,
      sent_at: typeof row.sent_at === 'string' ? row.sent_at : row.sent_at.toISOString(),
      status: row.status,
      label: ADVISORY_LABEL,
    }));

    return res.json({
      shipmentId,
      label: ADVISORY_LABEL,
      count: formattedNotifications.length,
      notifications: formattedNotifications,
    });
  })
);

/**
 * GET /ai/evaluations
 * Returns offline benchmark evaluations comparing online streaming models against
 * offline Isolation Forest and Local Outlier Factor.
 * Strictly advisory.
 */
router.get(
  '/evaluations',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const db = await getDbClient();

    const result = await db.query(
      `SELECT evaluation_id, model_name, model_version, precision,
              recall, false_alert_rate, avg_lead_time_seconds, dataset_name, created_at
       FROM ai_evaluations
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    const formattedEvaluations = result.rows.map((row) => ({
      evaluation_id: row.evaluation_id,
      model_name: row.model_name,
      model_version: row.model_version,
      precision: Number(row.precision),
      recall: Number(row.recall),
      false_alert_rate: Number(row.false_alert_rate),
      avg_lead_time_seconds: Number(row.avg_lead_time_seconds),
      dataset_name: row.dataset_name,
      created_at: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
      label: ADVISORY_LABEL,
    }));

    return res.json({
      count: formattedEvaluations.length,
      label: ADVISORY_LABEL,
      evaluations: formattedEvaluations,
    });
  })
);

/**
 * GET /ai/diagnose/:shipmentId
 * Invokes Gemini Root Cause Diagnostic AI through the AI Advisory Service.
 * Strictly advisory.
 */
router.get(
  '/diagnose/:shipmentId',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shipmentId } = req.params;
    const db = await getDbClient();

    const shipmentRes = await db.query(
      `SELECT s.shipment_id, s.profile_id, s.profile_version, p.parameters
       FROM shipments s
       JOIN profiles p ON s.profile_id = p.profile_id AND s.profile_version = p.version
       WHERE s.shipment_id = $1`,
      [shipmentId]
    );

    if (shipmentRes.rowCount === 0) {
      return res
        .status(404)
        .json(createErrorResponse('SHIPMENT_NOT_FOUND', `Shipment '${shipmentId}' does not exist`));
    }

    const row = shipmentRes.rows[0];
    const profile = typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters || {};

    // Fetch latest telemetry
    const latestBatchRes = await db.query(
      `SELECT payload, received_at FROM batches WHERE shipment_id = $1 ORDER BY sequence_no DESC LIMIT 5`,
      [shipmentId]
    );

    let currentTemp = 4.2;
    let currentHumidity = 50.0;
    const readingsContext: any[] = [];
    if (latestBatchRes.rowCount > 0) {
      for (const b of latestBatchRes.rows) {
        const payload = typeof b.payload === 'string' ? JSON.parse(b.payload) : b.payload;
        const rList = payload?.readings || [];
        for (const r of rList) {
          readingsContext.push(r);
        }
      }
      if (readingsContext.length > 0) {
        currentTemp = Number(readingsContext[readingsContext.length - 1].temperature ?? currentTemp);
        currentHumidity = Number(readingsContext[readingsContext.length - 1].humidity ?? currentHumidity);
      }
    }

    // Query AI service running on port 8000
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
      const aiRes = await fetch(`${aiServiceUrl}/diagnose/${shipmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cargo_type: profile.cargo_type || 'pharma-vaccine',
          profile_name: profile.name || 'Cold Chain Cargo',
          temp_min_c: profile.temp_min_c ?? 2.0,
          temp_max_c: profile.temp_max_c ?? 8.0,
          current_temp: currentTemp,
          current_humidity: currentHumidity,
          anomaly_kind: currentTemp > (profile.temp_max_c ?? 8.0) ? 'thermal_excursion_high' : 'thermal_variance',
          anomaly_score: 0.88,
          severity: currentTemp > (profile.temp_max_c ?? 8.0) ? 'critical' : 'warning',
          recent_readings: readingsContext.slice(-5),
        }),
      });

      if (aiRes.ok) {
        const diagData = await aiRes.json();
        return res.json(diagData);
      }
    } catch {
      // Graceful fallback if ai-service is unreachable
    }

    return res.json({
      available: false,
      shipment_id: shipmentId,
      label: ADVISORY_LABEL,
      message: 'Gemini diagnostic advisory engine temporarily unreachable.',
    });
  })
);

export default router;

