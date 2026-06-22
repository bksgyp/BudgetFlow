import { Router, Response } from 'express';
import { asyncHandler } from '../../middlewares/asyncHandler';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { taxService } from './tax.service';
import { runBenchmark } from './tax.benchmark';

const router = Router({ mergeParams: true });

router.get('/periods', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await taxService.getPeriods(req.params.projectId as string));
}));

router.post('/periods/:period/recalculate', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await taxService.recalculate(req.params.projectId as string, req.params.period as string));
}));

router.get('/periods/:period/readiness', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await taxService.getReadiness(req.params.projectId as string, req.params.period as string));
}));

router.get('/periods/:period/findings', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await taxService.getFindings(req.params.projectId as string, req.params.period as string));
}));

router.get('/periods/:period/fee-impact', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.status(200).json(taxService.getFeeImpact());
}));

router.post('/periods/:period/exports/accountant-packet', asyncHandler(async (req: AuthRequest, res: Response) => {
  const content = await taxService.buildAccountantPacket(req.params.projectId as string, req.params.period as string);
  res.status(200).json({ type: 'accountant_packet', period: req.params.period, content });
}));

router.post('/periods/:period/exports/self-filing-packet', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json(await taxService.buildSelfFilingPacket(req.params.projectId as string, req.params.period as string));
}));

router.post('/benchmarks/sroie', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.status(200).json(await runBenchmark());
}));

export const taxRouter = router;
