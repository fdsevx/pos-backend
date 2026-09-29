import { createMiddleware } from 'hono/factory';
import { sign, verify } from 'hono/jwt';
import type { Env, Variables, JwtPayload } from '../lib/types';

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256") as JwtPayload;
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }
});

export const generateTokens = async (payload: Omit<JwtPayload, 'exp'>, jwtSecret: string, jwtRefreshSecret: string) => {
  const now = Math.floor(Date.now() / 1000);
  const accessPayload: JwtPayload = { ...payload, exp: now + 3600 };
  const refreshPayload = { ...payload, exp: now + 7 * 24 * 3600 };

  const access_token = await sign(accessPayload, jwtSecret);
  const refresh_token = await sign(refreshPayload, jwtRefreshSecret);

  return { access_token, refresh_token, expires_in: 3600 };
};

export const verifyRefreshToken = async (token: string, secret: string): Promise<JwtPayload> => {
  return await verify(token, secret, "HS256") as JwtPayload;
};
