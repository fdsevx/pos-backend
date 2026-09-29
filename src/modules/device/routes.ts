import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { registerSchema, switchOutletSchema } from './schema';
import { registerDevice, switchOutlet, getDeviceMe } from './service';
import { authMiddleware } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { createDb } from '../../db/client';
import type { Env, Variables } from '../../lib/types';

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.use('*', authMiddleware);

const validatorHook = (result: any, c: any) => {
  if (!result.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: result.error.issues,
        },
      },
      400
    );
  }
};

router.post('/register', zValidator('json', registerSchema, validatorHook), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user');
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  
  const device = await registerDevice(db, data, user.sub);
  return c.json({ data: device });
});

router.put('/:device_id/outlet', requirePermission('outlet:switch'), zValidator('json', switchOutletSchema, validatorHook), async (c) => {
  const deviceId = c.req.param('device_id');
  const data = c.req.valid('json');
  const user = c.get('user');
  const db = createDb(c.env.HYPERDRIVE.connectionString);

  try {
    const updated = await switchOutlet(db, deviceId, data.outlet_id, user.sub);
    return c.json({ data: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 404);
  }
});

router.get('/me', async (c) => {
  const deviceId = c.req.header('x-device-id');
  if (!deviceId) {
    return c.json({ error: 'x-device-id header is missing' }, 400);
  }

  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const data = await getDeviceMe(db, deviceId);

  if (!data) {
    return c.json({ error: 'Device not found' }, 404);
  }

  return c.json({ data });
});

export default router;
