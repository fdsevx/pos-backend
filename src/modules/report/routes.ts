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

// GET /:outlet/reports/summary?start_date=2026-09-01&end_date=2026-09-30
reportRouter.get('/summary', requirePermission('report:read'), async (c) => {
  const outletId = c.get('outletId');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const month = c.req.query('month');

  if (month && !startDate) {
    const summary = await reportService.getMonthlySummary(c.get('db'), outletId, month);
    return c.json({ data: summary });
  }

  const summary = await reportService.getSummaryByDates(c.get('db'), outletId, startDate, endDate);
  return c.json({ data: summary });
});

// GET /:outlet/reports/monthly - Alias for summary
reportRouter.get('/monthly', requirePermission('report:read'), async (c) => {
  const outletId = c.get('outletId');
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  const summary = await reportService.getMonthlySummary(c.get('db'), outletId, month);
  return c.json({ data: summary });
});

// GET /:outlet/reports/chart?start_date=2026-09-01&end_date=2026-09-30
reportRouter.get('/chart', requirePermission('report:read'), async (c) => {
  const outletId = c.get('outletId');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const month = c.req.query('month');

  if (month && !startDate) {
    const chartData = await reportService.getChartData(c.get('db'), outletId, month);
    return c.json({ data: chartData });
  }

  const chartData = await reportService.getChartByDates(c.get('db'), outletId, startDate, endDate);
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
allReportRouter.use('*', async (c, next) => {
  if (!c.get('db')) {
    const { createDb } = await import('../../db/client');
    c.set('db', createDb(c.env.HYPERDRIVE.connectionString));
  }
  await next();
});

allReportRouter.get('/monthly', requirePermission('report:read'), zValidator('query', monthlyQuerySchema), async (c) => {
  const user = c.get('user');
  const month = c.req.valid('query').month;
  const locationId = c.req.query('location_id');
  
  const summary = await reportService.getAllOutletsMonthlySummary(c.get('db'), user.role === 'super_admin' ? null : user.outlet_ids, month, locationId);
  return c.json({ data: summary });
});

allReportRouter.get('/summary', requirePermission('report:read'), async (c) => {
  const user = c.get('user');
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  const locationId = c.req.query('location_id');
  
  const summary = await reportService.getAllOutletsMonthlySummary(c.get('db'), user.role === 'super_admin' ? null : user.outlet_ids, month, locationId);
  return c.json({ data: summary });
});

allReportRouter.get('/chart', requirePermission('report:read'), async (c) => {
  const user = c.get('user');
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  const locationId = c.req.query('location_id');
  
  const chartData = await reportService.getAllOutletsChartData(c.get('db'), user.role === 'super_admin' ? null : user.outlet_ids, month, locationId);
  return c.json({ data: chartData });
});

allReportRouter.get('/export', requirePermission('report:read'), zValidator('query', exportQuerySchema), async (c) => {
  const user = c.get('user');
  const locationId = c.req.query('location_id');
  const { from, to, page, limit } = c.req.valid('query');
  
  const data = await reportService.getAllOutletsExportData(c.get('db'), user.role === 'super_admin' ? null : user.outlet_ids, locationId, from, to, page, limit);
  return c.json({ data, page, limit });
});

export { reportRouter, allReportRouter };
