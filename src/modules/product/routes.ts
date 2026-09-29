import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { outletMiddleware } from '../../middleware/outlet';
import { productSchema, opnameSchema } from './schema';
import * as service from './service';
import type { Env, Variables } from '../../lib/types';

const productRouter = new Hono<{ Bindings: Env; Variables: Variables }>();
const opnameRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

productRouter.use('*', authMiddleware);
productRouter.use('*', outletMiddleware);

productRouter.get('/', async (c) => {
  const outletId = c.get('outletId');
  const products = await service.getProducts(c.get('db'), outletId);
  return c.json({ success: true, data: products });
});

productRouter.post('/', zValidator('json', productSchema), async (c) => {
  const user = c.get('user');
  if (user.permissions && !user.permissions.includes('menu:write')) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  
  const outletId = c.get('outletId');
  const data = c.req.valid('json');
  const product = await service.createProduct(c.get('db'), outletId, data);
  return c.json({ success: true, data: product }, 201);
});

productRouter.put('/:id', zValidator('json', productSchema.partial()), async (c) => {
  const user = c.get('user');
  if (user.permissions && !user.permissions.includes('menu:write')) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  const data = c.req.valid('json');
  try {
    const product = await service.updateProduct(c.get('db'), outletId, id, data, user.sub);
    return c.json({ success: true, data: product });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
});

productRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  if (user.permissions && !user.permissions.includes('menu:write')) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  const outletId = c.get('outletId');
  const id = c.req.param('id');
  await service.deleteProduct(c.get('db'), outletId, id);
  return c.json({ success: true, message: 'Product deleted' });
});

opnameRouter.use('*', authMiddleware);
opnameRouter.use('*', outletMiddleware);

opnameRouter.post('/', zValidator('json', opnameSchema), async (c) => {
  const user = c.get('user');
  if (user.permissions && !user.permissions.includes('stock:write')) {
    return c.json({ success: false, message: 'Forbidden' }, 403);
  }
  const outletId = c.get('outletId');
  const data = c.req.valid('json');
  try {
    await service.performOpname(c.get('db'), outletId, user.sub, data);
    return c.json({ success: true, message: 'Opname recorded successfully' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
});

export { productRouter, opnameRouter };
