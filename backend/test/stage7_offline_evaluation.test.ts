import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { setTestDbClient, DbClient } from '../src/db';
import { ADVISORY_LABEL, getUtcTimestamp } from '@frostledger/shared';

describe('Stage 7: Offline ML Evaluation & Shadow Validation Integration', () => {
  let app: any;
  let pglite: PGlite;
  let testDb: DbClient;
  const JWT_SECRET = 'frostledger_default_development_secret_32_chars';
  let auditorToken: string;

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

    auditorToken = jwt.sign(
      {
        user_id: 'usr-stage7-auditor',
        email: 'auditor@frostledger.io',
        role: 'auditor',
        org_id: 'org-stage7',
      },
      JWT_SECRET
    );
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('Check 1: GET /ai/evaluations rejects unauthenticated requests', async () => {
    const res = await request(app).get('/ai/evaluations');
    expect(res.status).toBe(401);
  });

  it('Check 2: GET /ai/evaluations returns empty list with mandatory advisory label', async () => {
    const res = await request(app)
      .get('/ai/evaluations')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.label).toBe(ADVISORY_LABEL);
    expect(res.body.count).toBe(0);
    expect(res.body.evaluations).toEqual([]);
  });

  it('Check 3: GET /ai/evaluations retrieves benchmark metrics for online and offline models', async () => {
    // Insert mock evaluation records
    await testDb.query(
      `INSERT INTO ai_evaluations (
        evaluation_id, model_name, model_version, precision,
        recall, false_alert_rate, avg_lead_time_seconds, dataset_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'eval_stream_01',
        'online_streaming_hst_cusum',
        'v1.0.0',
        0.92,
        0.95,
        0.03,
        720.0,
        'coldchain_synthetic_benchmark_v1',
        getUtcTimestamp(),
      ]
    );

    await testDb.query(
      `INSERT INTO ai_evaluations (
        evaluation_id, model_name, model_version, precision,
        recall, false_alert_rate, avg_lead_time_seconds, dataset_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'eval_iso_01',
        'offline_isolation_forest',
        'v1.0.0',
        0.88,
        0.91,
        0.04,
        0.0,
        'coldchain_synthetic_benchmark_v1',
        getUtcTimestamp(),
      ]
    );

    await testDb.query(
      `INSERT INTO ai_evaluations (
        evaluation_id, model_name, model_version, precision,
        recall, false_alert_rate, avg_lead_time_seconds, dataset_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        'eval_lof_01',
        'offline_local_outlier_factor',
        'v1.0.0',
        0.86,
        0.89,
        0.05,
        0.0,
        'coldchain_synthetic_benchmark_v1',
        getUtcTimestamp(),
      ]
    );

    const res = await request(app)
      .get('/ai/evaluations')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.label).toBe(ADVISORY_LABEL);

    const streamModel = res.body.evaluations.find(
      (e: any) => e.model_name === 'online_streaming_hst_cusum'
    );
    expect(streamModel).toBeDefined();
    expect(streamModel.label).toBe(ADVISORY_LABEL);
    expect(streamModel.precision).toBe(0.92);
    expect(streamModel.recall).toBe(0.95);
    expect(streamModel.avg_lead_time_seconds).toBe(720.0);

    const isoModel = res.body.evaluations.find(
      (e: any) => e.model_name === 'offline_isolation_forest'
    );
    expect(isoModel).toBeDefined();
    expect(isoModel.precision).toBe(0.88);
  });

  it('Check 4: Evaluations table operations never impact official tables', async () => {
    const alerts = await testDb.query('SELECT * FROM alerts');
    expect(alerts.rowCount).toBe(0);

    const evals = await testDb.query('SELECT * FROM ai_evaluations');
    expect(evals.rowCount).toBe(3);
  });
});
