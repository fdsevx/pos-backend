import { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env, Variables } from '../lib/types';

export const errorHandler: ErrorHandler<{ Bindings: Env; Variables: Variables }> = (err, c) => {
  console.error(err);

  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: 'HTTP_ERROR', message: err.message } },
      err.status
    );
  }

  return c.json(
    { 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: err.message || 'Something went wrong',
        stack: err.stack 
      } 
    },
    500
  );
};
