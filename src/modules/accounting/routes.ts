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
accountingRouter.get('/coa', requirePermission('accounting:read'), async (c) => {
  const data = await acctService.getCOA(c.get('db'), c.get('outletId'));
  return c.json({ data });
});

accountingRouter.post('/coa', requirePermission('accounting:write'), zValidator('json', coaSchema), async (c) => {
  const data = await acctService.createCOA(c.get('db'), c.get('outletId'), c.req.valid('json'));
  return c.json({ data }, 201);
});

// --- Manual Journal ---
accountingRouter.post('/journals/manual', requirePermission('accounting:write'), zValidator('json', manualJournalSchema), async (c) => {
  try {
    const data = await acctService.createManualJournal(c.get('db'), c.get('outletId'), c.get('user').sub, c.req.valid('json'));
    return c.json({ data }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// --- Lock Period ---
accountingRouter.post('/periods/lock', requirePermission('accounting:write'), zValidator('json', lockPeriodSchema), async (c) => {
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

// GET /:outlet/accounting/ledger (Buku Besar)
const handleLedger = async (c: any) => {
  const { from, to } = { ...getDefaultDates(), ...c.req.query() };
  const data = await acctService.getGeneralLedger(c.get('db'), c.get('outletId'), from!, to!);
  return c.json({ data, period: { from, to } });
};
accountingRouter.get('/ledger', requirePermission('accounting:read'), handleLedger);
accountingRouter.get('/reports/general-ledger', requirePermission('accounting:read'), handleLedger);

// GET /:outlet/accounting/trial-balance (Neraca Saldo)
const handleTrialBalance = async (c: any) => {
  const { from, to } = { ...getDefaultDates(), ...c.req.query() };
  const data = await acctService.getTrialBalance(c.get('db'), c.get('outletId'), from!, to!);
  return c.json({ data, period: { from, to } });
};
accountingRouter.get('/trial-balance', requirePermission('accounting:read'), handleTrialBalance);
accountingRouter.get('/reports/trial-balance', requirePermission('accounting:read'), handleTrialBalance);

// GET /:outlet/accounting/income-statement (Laba Rugi)
const handleIncomeStatement = async (c: any) => {
  const { from, to } = { ...getDefaultDates(), ...c.req.query() };
  const data = await acctService.getIncomeStatement(c.get('db'), c.get('outletId'), from!, to!);
  return c.json({ data, period: { from, to } });
};
accountingRouter.get('/income-statement', requirePermission('accounting:read'), handleIncomeStatement);
accountingRouter.get('/reports/income-statement', requirePermission('accounting:read'), handleIncomeStatement);

// GET /:outlet/accounting/balance-sheet (Neraca Keuangan)
const handleBalanceSheet = async (c: any) => {
  const to = c.req.query('to') || new Date().toISOString().split('T')[0];
  const data = await acctService.getBalanceSheet(c.get('db'), c.get('outletId'), to);
  return c.json({ data, as_of: to });
};
accountingRouter.get('/balance-sheet', requirePermission('accounting:read'), handleBalanceSheet);
accountingRouter.get('/reports/balance-sheet', requirePermission('accounting:read'), handleBalanceSheet);

// GET /:outlet/accounting/reports/cash-flow
accountingRouter.get('/reports/cash-flow', requirePermission('accounting:read'), async (c) => {
  const { from, to } = { ...getDefaultDates(), ...c.req.query() };
  const data = await acctService.getCashFlow(c.get('db'), c.get('outletId'), from!, to!);
  return c.json({ data, period: { from, to } });
});

export default accountingRouter;
