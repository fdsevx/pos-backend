import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { supplierSchema } from './schema';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from './service';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { requirePermission } from '../../middleware/rbac';

import type { Env, Variables } from '../../lib/types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', authMiddleware, outletMiddleware);

app.get('/', async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const suppliers = await listSuppliers(db, outletId);
  return c.json({ success: true, data: suppliers });
});

app.post('/', requirePermission('supplier:write'), zValidator('json', supplierSchema), async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const data = c.req.valid('json');
  const newSupplier = await createSupplier(db, outletId, data);
  return c.json({ success: true, data: newSupplier }, 201);
});

app.put('/:id', requirePermission('supplier:write'), zValidator('json', supplierSchema.partial()), async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  const data = c.req.valid('json');
  
  const updatedSupplier = await updateSupplier(db, outletId, id, data);
  if (!updatedSupplier) {
    return c.json({ success: false, error: 'Supplier not found' }, 404);
  }
  
  return c.json({ success: true, data: updatedSupplier });
});

app.delete('/:id', requirePermission('supplier:write'), async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  
  const deletedSupplier = await deleteSupplier(db, outletId, id);
  if (!deletedSupplier) {
    return c.json({ success: false, error: 'Supplier not found' }, 404);
  }
  
  return c.json({ success: true, data: deletedSupplier });
});

export default app;
