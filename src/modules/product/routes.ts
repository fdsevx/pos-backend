import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { productSchema, opnameSchema } from './schema';
import * as service from './service';
import { outlets } from '../../db/schema';
import type { Env, Variables } from '../../lib/types';

const productRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
const opnameRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

productRouter.use('*', authMiddleware);
productRouter.use('*', outletMiddleware);

const canWriteMenu = (user: any) => {
  if (user.role === 'super_admin') return true;
  return user.permissions?.includes('menu:write');
};

const canWriteStock = (user: any) => {
  if (user.role === 'super_admin') return true;
  return user.permissions?.includes('stock:write');
};

productRouter.get('/', async (c) => {
  const outletId = c.get('outletId');
  const user = c.get('user');
  const db = c.get('db');

  if (outletId === 'ALL') {
    const allowedOutlets = user.role === 'super_admin' ? null : (user.outlet_ids || []);
    const products = await service.getAllProducts(db, allowedOutlets);
    return c.json({ success: true, data: products });
  }

  const products = await service.getProducts(db, outletId);
  return c.json({ success: true, data: products });
});

productRouter.post('/', zValidator('json', productSchema), async (c) => {
  const user = c.get('user');
  if (!canWriteMenu(user)) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  
  let outletId = c.get('outletId');
  const data = c.req.valid('json');
  const db = c.get('db');

  if (outletId === 'ALL') {
    if (data.outlet_id) {
      outletId = data.outlet_id;
    } else if (user.outlet_ids && user.outlet_ids.length > 0) {
      outletId = user.outlet_ids[0];
    } else {
      const result = await db.select({ id: outlets.id }).from(outlets).limit(1);
      if (result.length === 0) {
        return c.json({ success: false, message: 'No outlet available to assign product' }, 400);
      }
      outletId = result[0].id;
    }
  }

  if (user.role !== 'super_admin' && !user.outlet_ids?.includes(outletId)) {
    return c.json({ success: false, message: 'Forbidden: No access to this outlet' }, 403);
  }

  const product = await service.createProduct(db, outletId, data as any);
  return c.json({ success: true, data: product }, 201);
});

productRouter.put('/:id', zValidator('json', productSchema.partial()), async (c) => {
  const user = c.get('user');
  if (!canWriteMenu(user)) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  const data = c.req.valid('json');
  try {
    const product = await service.updateProduct(c.get('db'), outletId, id, data as any, user.sub);
    return c.json({ success: true, data: product });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
});

productRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!canWriteMenu(user)) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  try {
    await service.deleteProduct(c.get('db'), outletId, id);
    return c.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
});

opnameRouter.use('*', authMiddleware);
opnameRouter.use('*', outletMiddleware);

opnameRouter.post('/', zValidator('json', opnameSchema), async (c) => {
  const user = c.get('user');
  if (!canWriteStock(user)) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  const outletId = c.get('outletId');
  const data = c.req.valid('json');
  try {
    await service.performOpname(c.get('db'), outletId, user.sub, data as any);
    return c.json({ success: true, message: 'Opname recorded successfully' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
});

export { productRouter, opnameRouter };
