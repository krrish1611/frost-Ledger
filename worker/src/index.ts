import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { processBatchInWorker, WorkerJobPayload } from './processor';

dotenv.config();

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/coldchain',
});

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsedRedis = new URL(redisUrl);

console.log('[Worker] Starting BullMQ consumer on coldchain-batch-processing...');

const worker = new Worker<WorkerJobPayload>(
  'coldchain-batch-processing',
  async (job: Job<WorkerJobPayload>) => {
    console.log(`[Worker] Received job ${job.id} for batch ${job.data.batch_id}`);
    const result = await processBatchInWorker(db, job.data);
    console.log(
      `[Worker] Processed batch ${job.data.batch_id}: MKT=${result.mkt}°C, remainingLife=${result.remainingLife}h, alerts=${result.alertCount}`
    );
    return result;
  },
  {
    connection: {
      host: parsedRedis.hostname,
      port: Number(parsedRedis.port) || 6379,
      password: parsedRedis.password || undefined,
    },
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err);
});

export { worker, db };
