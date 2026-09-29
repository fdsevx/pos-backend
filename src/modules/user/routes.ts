import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { userCreateSchema, userUpdateSchema, resetPasswordSchema } from './schema';
import * as userService from './service';
import { authMiddleware } from '../../middleware/auth';
import type { Env, Variables } from '../../lib/types';

const userRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All user management routes require authentication and super_admin role
userRouter.use('*', authMiddleware);

userRouter.use('*', async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    return c.json({ error: 'Forbidden. Admin access required.' }, 403);
  }
  await next();
});

// Since user routes are global, we extract db directly from env (similar to auth)
userRouter.use('*', async (c, next) => {
  if (!c.get('db')) {
    const { createDb } = await import('../../db/client');
    const dbClient = createDb(c.env.HYPERDRIVE.connectionString);
    c.set('db', dbClient as any);
  }
  await next();
});

userRouter.get('/', async (c) => {
  const data = await userService.getUsers(c.get('db'));
  return c.json({ data });
});

userRouter.post('/', zValidator('json', userCreateSchema), async (c) => {
  try {
    const data = await userService.createUser(c.get('db'), c.req.valid('json'));
    return c.json({ data }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

userRouter.put('/:id', zValidator('json', userUpdateSchema), async (c) => {
  try {
    const data = await userService.updateUser(c.get('db'), c.req.param('id'), c.req.valid('json'));
    return c.json({ data });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

userRouter.put('/:id/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  try {
    const data = await userService.resetUserPassword(c.get('db'), c.req.param('id'), c.req.valid('json').new_password);
    return c.json({ data });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

userRouter.delete('/:id', async (c) => {
  try {
    await userService.deleteUser(c.get('db'), c.req.param('id'));
    return c.json({ success: true, message: 'User deleted' });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

export default userRouter;
