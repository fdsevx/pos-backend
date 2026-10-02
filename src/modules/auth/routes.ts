import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { createDb } from "../../db/client";
import { authMiddleware } from "../../middleware/auth";
import { loginSchema, refreshSchema, registerSchema } from "./schema";
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
  "/register",
  zValidator("json", registerSchema, validatorHook),
  async (c) => {
    const input = c.req.valid("json");
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const result = await authService.register(db, input);
    return c.json({ user: result, message: "Registration successful. Waiting for superadmin approval." }, 201);
  }
);

auth.post(
  "/login",
  zValidator("json", loginSchema, validatorHook),
  async (c) => {
    const { username, email, password } = c.req.valid("json");
    const loginIdentifier = username || email;
    const db = createDb(c.env.HYPERDRIVE.connectionString);
    const result = await authService.login(db, loginIdentifier!, password, c.env.JWT_SECRET, c.env.JWT_REFRESH_SECRET);
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
