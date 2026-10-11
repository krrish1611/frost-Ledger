import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createErrorResponse, getUtcTimestamp } from '@frostledger/shared';
import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import shipmentRoutes from './routes/shipmentRoutes';
import adminRoutes from './routes/adminRoutes';
import telemetryRoutes from './routes/telemetryRoutes';
import alertRoutes from './routes/alertRoutes';
import verificationRoutes from './routes/verificationRoutes';
import aiRoutes from './routes/aiRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import { rateLimiter } from './middleware/rateLimit';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(rateLimiter(200, 60000));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: getUtcTimestamp() });
  });

  // Mount API modules
  app.use('/', telemetryRoutes);
  app.use('/', dashboardRoutes);
  app.use('/auth', authRoutes);
  app.use('/profiles', profileRoutes);
  app.use('/shipments', shipmentRoutes);
  app.use('/alerts', alertRoutes);
  app.use('/verify', verificationRoutes);
  app.use('/ai', aiRoutes);
  app.use('/admin', adminRoutes);

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json(createErrorResponse('NOT_FOUND', 'The requested resource was not found'));
  });

  // Global Error Handler (Rule 12)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[App Error]', err);
    const statusCode = err.status || 500;
    const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'An unexpected error occurred';
    res.status(statusCode).json(createErrorResponse(errorCode, message));
  });

  return app;
}

export default createApp;
