import type { createDb } from "../db/client";

export type Env = {
  HYPERDRIVE: Hyperdrive;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
};

export type JwtPayload = {
  sub: string; // user id
  username: string;
  role: string;
  outlet_ids: string[];
  permissions: string[];
  exp: number;
};

export type Variables = {
  user: JwtPayload;
  outletId: string;
  db: ReturnType<typeof createDb>;
};
