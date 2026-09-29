import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { createDb } from "../../db/client";
import { authMiddleware } from "../../middleware/auth";
import { outletMiddleware } from "../../middleware/outlet";
import { requirePermission } from "../../middleware/rbac";
import { updateSettingsSchema } from "./schema";
import { getOutlets, getSettings, updateSettings } from "./service";

const outlet = new Hono<{ Bindings: Env; Variables: Variables }>();

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

outlet.get("/", authMiddleware, async (c) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const user = c.get("user") as any;
  const outlets = await getOutlets(db, user.outlet_ids || []);
  return c.json(outlets);
});

outlet.get("/:outlet/settings", authMiddleware, outletMiddleware, async (c) => {
  const db = c.get("db") as any;
  const outletId = c.get("outletId") as string;
  const settings = await getSettings(db, outletId);
  return c.json(settings);
});

outlet.put(
  "/:outlet/settings",
  authMiddleware,
  outletMiddleware,
  requirePermission("outlet:write"),
  zValidator("json", updateSettingsSchema, validatorHook),
  async (c) => {
    const db = c.get("db") as any;
    const outletId = c.get("outletId") as string;
    const data = c.req.valid("json");
    const updated = await updateSettings(db, outletId, data);
    return c.json(updated);
  }
);

export default outlet;
