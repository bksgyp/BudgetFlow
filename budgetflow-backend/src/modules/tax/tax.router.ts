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
  const projectId = req.params.projectId as string;
  const period = req.params.period as string;
  const pdf = await taxService.buildAccountantPacketPdf(projectId, period);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="accountant-packet-${period}.pdf"; filename*=UTF-8''${encodeURIComponent(`세무사패킷-${period}.pdf`)}`,
  );
  res.status(200).end(pdf);
}));

router.post('/periods/:period/exports/self-filing-packet', asyncHandler(async (req: AuthRequest, res: Response) => {
  const projectId = req.params.projectId as string;
  const period = req.params.period as string;
  const csv = await taxService.buildSelfFilingCsv(projectId, period);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="self-filing-${period}.csv"; filename*=UTF-8''${encodeURIComponent(`직접신고-${period}.csv`)}`,
  );
  res.status(200).send(csv);
}));

router.post('/benchmarks/sroie', asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.status(200).json(await runBenchmark());
}));

export const taxRouter = router;
