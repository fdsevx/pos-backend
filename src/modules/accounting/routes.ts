import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { coaSchema, manualJournalSchema, lockPeriodSchema, reportQuerySchema } from './schema';
import * as acctService from './service';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { requirePermission } from '../../middleware/rbac';
import type { Env, Variables } from '../../lib/types';

const accountingRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

accountingRouter.use('*', authMiddleware, outletMiddleware);

// --- COA ---
accountingRouter.get('/coa', requirePermission('journal:read'), async (c) => {
  const data = await acctService.getCOA(c.get('db'), c.get('outletId'));
  return c.json({ data });
});

accountingRouter.post('/coa', requirePermission('journal:write'), zValidator('json', coaSchema), async (c) => {
  const data = await acctService.createCOA(c.get('db'), c.get('outletId'), c.req.valid('json'));
  return c.json({ data }, 201);
});

accountingRouter.put('/coa/:id', requirePermission('journal:write'), zValidator('json', coaSchema), async (c) => {
  const data = await acctService.updateCOA(c.get('db'), c.get('outletId'), c.req.param('id'), c.req.valid('json'));
  return c.json({ data });
});

accountingRouter.delete('/coa/:id', requirePermission('journal:write'), async (c) => {
  try {
    await acctService.deleteCOA(c.get('db'), c.get('outletId'), c.req.param('id'));
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: { message: err.message } }, 400);
  }
});

// --- Manual Journal ---
accountingRouter.post('/journals/manual', requirePermission('journal:write'), zValidator('json', manualJournalSchema), async (c) => {
  try {
    const data = await acctService.createManualJournal(c.get('db'), c.get('outletId'), c.get('user').sub, c.req.valid('json'));
    return c.json({ data }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// --- Lock Period ---
accountingRouter.post('/periods/lock', requirePermission('journal:write'), zValidator('json', lockPeriodSchema), async (c) => {
  await acctService.lockPeriod(c.get('db'), c.get('outletId'), c.req.valid('json').month);
  return c.json({ success: true, message: `Period ${c.req.valid('json').month} locked` });
});

// --- Reports Helper ---
const getDefaultDates = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from: firstDay, to: lastDay };
};

// Helper to sanitize dates to valid calendar dates (prevents PostgreSQL "date/time out of range" like 2026-09-31)
const sanitizeDate = (dateStr: string | undefined, defaultDate: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return defaultDate;
  const match = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return defaultDate;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12) return defaultDate;
  const maxDays = new Date(year, month, 0).getDate();
  const validDay = Math.min(Math.max(1, day), maxDays);
  return `${year}-${String(month).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
};

const getPeriodDates = (c: any) => {
  const defaults = getDefaultDates();
  const rawFrom = c.req.query('from');
  const rawTo = c.req.query('to');
  return {
    from: sanitizeDate(rawFrom, defaults.from),
    to: sanitizeDate(rawTo, defaults.to),
  };
};

// GET /:outlet/accounting/ledger (Buku Besar)
const handleLedger = async (c: any) => {
  const { from, to } = getPeriodDates(c);
  const data = await acctService.getGeneralLedger(c.get('db'), c.get('outletId'), from, to);
  return c.json({ data, period: { from, to } });
};
accountingRouter.get('/ledger', requirePermission('journal:read'), handleLedger);
accountingRouter.get('/reports/general-ledger', requirePermission('journal:read'), handleLedger);

// GET /:outlet/accounting/trial-balance (Neraca Saldo)
const handleTrialBalance = async (c: any) => {
  const { from, to } = getPeriodDates(c);
  const data = await acctService.getTrialBalance(c.get('db'), c.get('outletId'), from, to);
  return c.json({ data, period: { from, to } });
};
accountingRouter.get('/trial-balance', requirePermission('journal:read'), handleTrialBalance);
accountingRouter.get('/reports/trial-balance', requirePermission('journal:read'), handleTrialBalance);

// GET /:outlet/accounting/income-statement (Laba Rugi)
const handleIncomeStatement = async (c: any) => {
  const { from, to } = getPeriodDates(c);
  const data = await acctService.getIncomeStatement(c.get('db'), c.get('outletId'), from, to);
  return c.json({ data, period: { from, to } });
};
accountingRouter.get('/income-statement', requirePermission('journal:read'), handleIncomeStatement);
accountingRouter.get('/reports/income-statement', requirePermission('journal:read'), handleIncomeStatement);

// GET /:outlet/accounting/balance-sheet (Neraca Keuangan)
const handleBalanceSheet = async (c: any) => {
  const defaultTo = new Date().toISOString().split('T')[0];
  const to = sanitizeDate(c.req.query('to'), defaultTo);
  const data = await acctService.getBalanceSheet(c.get('db'), c.get('outletId'), to);
  return c.json({ data, as_of: to });
};
accountingRouter.get('/balance-sheet', requirePermission('journal:read'), handleBalanceSheet);
accountingRouter.get('/reports/balance-sheet', requirePermission('journal:read'), handleBalanceSheet);

// GET /:outlet/accounting/reports/cash-flow
accountingRouter.get('/reports/cash-flow', requirePermission('journal:read'), async (c) => {
  const { from, to } = getPeriodDates(c);
  const data = await acctService.getCashFlow(c.get('db'), c.get('outletId'), from, to);
  return c.json({ data, period: { from, to } });
});

export default accountingRouter;
