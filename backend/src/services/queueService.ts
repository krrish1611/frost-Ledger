import { Queue } from 'bullmq';

export interface BatchJobData {
  batch_id: string;
  shipment_id: string;
  device_id: string;
  sequence_no: number;
}

let bullQueue: Queue | null = null;
const memoryQueue: BatchJobData[] = [];

export function getQueue(): Queue | null {
  if (bullQueue) return bullQueue;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && process.env.NODE_ENV !== 'test') {
    try {
      const url = new URL(redisUrl);
      bullQueue = new Queue('coldchain-batch-processing', {
        connection: {
          host: url.hostname,
          port: Number(url.port) || 6379,
          password: url.password || undefined,
        },
      });
    } catch {
      bullQueue = null;
    }
  }

  return bullQueue;
}

export async function enqueueBatchProcessing(job: BatchJobData): Promise<void> {
  const queue = getQueue();
  if (queue) {
    try {
      await queue.add('process-batch', job, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
      return;
    } catch (err) {
      console.warn('[Queue] Failed to enqueue to Redis BullMQ, saving to memory fallback:', err);
    }
  }

  // Fallback in-memory tracking for test / offline mode
  memoryQueue.push(job);
}

export function getMemoryEnqueuedJobs(): BatchJobData[] {
  return [...memoryQueue];
}

export function clearMemoryEnqueuedJobs(): void {
  memoryQueue.length = 0;
}
