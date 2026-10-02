import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../lib/types';

export const requirePermission = (...permissions: string[]) => {
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } }, 401);
    }

    if (user.role === 'super_admin') {
      await next();
      return;
    }

    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
    const hasAllPermissions = permissions.every(p => userPerms.includes(p));
    if (!hasAllPermissions) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403);
    }

    await next();
  });
};

export const requireRole = (...roles: string[]) => {
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } }, 401);
    }

    if (user.role === 'super_admin' || roles.includes(user.role)) {
      await next();
      return;
    }

    return c.json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }, 403);
  });
};
