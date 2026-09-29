import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { categorySchema } from './schema';
import { listCategories, createCategory, updateCategory, deleteCategory } from './service';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { requirePermission } from '../../middleware/rbac';

import type { Env, Variables } from '../../lib/types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', authMiddleware, outletMiddleware);

app.get('/', async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const categories = await listCategories(db, outletId);
  return c.json({ success: true, data: categories });
});

app.post('/', requirePermission('menu:write'), zValidator('json', categorySchema), async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const data = c.req.valid('json');
  const newCategory = await createCategory(db, outletId, data);
  return c.json({ success: true, data: newCategory }, 201);
});

app.put('/:id', requirePermission('menu:write'), zValidator('json', categorySchema.partial()), async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  const data = c.req.valid('json');
  
  const updatedCategory = await updateCategory(db, outletId, id, data);
  if (!updatedCategory) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  
  return c.json({ success: true, data: updatedCategory });
});

app.delete('/:id', requirePermission('menu:write'), async (c) => {
  const db = c.get('db');
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  
  const deletedCategory = await deleteCategory(db, outletId, id);
  if (!deletedCategory) {
    return c.json({ success: false, error: 'Category not found' }, 404);
  }
  
  return c.json({ success: true, data: deletedCategory });
});

export default app;
