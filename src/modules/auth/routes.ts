import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { createDb } from "../../db/client";
import { authMiddleware } from "../../middleware/auth";
import { loginSchema, refreshSchema } from "./schema";
import * as authService from "./service";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

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

auth.post(
  "/login",
  zValidator("json", loginSchema, validatorHook),
  async (c) => {
    const { username, password } = c.req.valid("json");
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const result = await authService.login(db, username, password, c.env.JWT_SECRET, c.env.JWT_REFRESH_SECRET);
    return c.json(result);
  }
);

auth.post(
  "/refresh",
  zValidator("json", refreshSchema, validatorHook),
  async (c) => {
    const { refresh_token } = c.req.valid("json");
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const result = await authService.refresh(db, refresh_token, c.env.JWT_SECRET, c.env.JWT_REFRESH_SECRET);
    return c.json(result);
  }
);

auth.post("/logout", authMiddleware, async (c) => {
  return c.json({ message: "Logged out" });
});

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const result = await authService.getMe(db, user.sub);
  return c.json({ user: result });
});

export default auth;
