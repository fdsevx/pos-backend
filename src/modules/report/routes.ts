import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { monthlyQuerySchema, exportQuerySchema } from './schema';
import * as reportService from './service';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { requirePermission } from '../../middleware/rbac';
import type { Env, Variables } from '../../lib/types';

const reportRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
const allReportRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Single outlet reports
reportRouter.use('*', authMiddleware, outletMiddleware);

reportRouter.get('/monthly', requirePermission('report:read'), zValidator('query', monthlyQuerySchema), async (c) => {
  const outletId = c.get('outletId');
  const month = c.req.valid('query').month;
  
  const summary = await reportService.getMonthlySummary(c.get('db'), outletId, month);
  return c.json({ data: summary });
});

reportRouter.get('/chart', requirePermission('report:read'), zValidator('query', monthlyQuerySchema), async (c) => {
  const outletId = c.get('outletId');
  const month = c.req.valid('query').month;
  
  const chartData = await reportService.getChartData(c.get('db'), outletId, month);
  return c.json({ data: chartData });
});

reportRouter.get('/export', requirePermission('report:read'), zValidator('query', exportQuerySchema), async (c) => {
  const outletId = c.get('outletId');
  const { from, to, page, limit } = c.req.valid('query');
  
  const data = await reportService.getExportData(c.get('db'), outletId, from, to, page, limit);
  return c.json({ data, page, limit });
});

// All outlets reports (Cross-outlet for super_admin / owner)
allReportRouter.use('*', authMiddleware);

allReportRouter.get('/monthly', requirePermission('report:read'), zValidator('query', monthlyQuerySchema), async (c) => {
  const user = c.get('user');
  const month = c.req.valid('query').month;
  
  const summary = await reportService.getAllOutletsMonthlySummary(c.get('db'), user.outlet_ids, month);
  return c.json({ data: summary });
});

export { reportRouter, allReportRouter };
