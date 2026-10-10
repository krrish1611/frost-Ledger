import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { verifyShipmentArrival, generateHtmlIntegrityReport } from '../services/verificationService';
import { createErrorResponse } from '@frostledger/shared';

const router = Router();

/**
 * GET /verify/:shipmentId
 * Recomputes every batch hash, checks every signature, hash chain, and sequence gaps,
 * compares with on-chain blockchain records, and returns pass/fail with full details.
 */
router.get(
  '/:shipmentId',
  asyncHandler(async (req: Request, res: Response) => {
    const { shipmentId } = req.params;

    try {
      const report = await verifyShipmentArrival(shipmentId);

      // Support HTML view via format query parameter or Accept header
      if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
        const html = generateHtmlIntegrityReport(report);
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      }

      return res.json(report);
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json(createErrorResponse('NOT_FOUND', err.message));
      }
      throw err;
    }
  })
);

/**
 * GET /verify/:shipmentId/report
 * Dedicated printable HTML integrity audit report view
 */
router.get(
  '/:shipmentId/report',
  asyncHandler(async (req: Request, res: Response) => {
    const { shipmentId } = req.params;

    try {
      const report = await verifyShipmentArrival(shipmentId);

      if (req.query.format === 'json') {
        return res.json(report);
      }

      const html = generateHtmlIntegrityReport(report);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json(createErrorResponse('NOT_FOUND', err.message));
      }
      throw err;
    }
  })
);

export default router;
