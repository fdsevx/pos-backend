import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { createDb } from "../../db/client";
import { authMiddleware } from "../../middleware/auth";
import { outletMiddleware } from "../../middleware/outlet";
import { requirePermission } from "../../middleware/rbac";
import { updateSettingsSchema, createOutletSchema } from "./schema";
import { getOutlets, getSettings, updateSettings, createOutlet, deleteOutlet } from "./service";

const outlet = new Hono<{ Bindings: Env; Variables: Variables }>();
const outletSettingsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

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
  const outlets = await getOutlets(db, user.outlet_ids || [], user.role === 'super_admin');
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
    const user = c.get("user") as any;
    const data = c.req.valid("json");
    const updated = await updateSettings(db, outletId, data, user.sub);
    return c.json(updated);
  }
);

// Router mounted directly at /api/v1/:outlet/settings
outletSettingsRouter.use("*", authMiddleware, outletMiddleware);

outletSettingsRouter.get("/", async (c) => {
  const db = c.get("db") as any;
  const outletId = c.get("outletId") as string;
  const settings = await getSettings(db, outletId);
  return c.json(settings);
});

outletSettingsRouter.put(
  "/",
  requirePermission("outlet:write"),
  zValidator("json", updateSettingsSchema, validatorHook),
  async (c) => {
    const db = c.get("db") as any;
    const outletId = c.get("outletId") as string;
    const user = c.get("user") as any;
    const data = c.req.valid("json");
    const updated = await updateSettings(db, outletId, data, user.sub);
    return c.json(updated);
  }
);

import { locations } from "../../db/schema";

const locationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

locationRouter.get("/", authMiddleware, async (c) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const locs = await db.select().from(locations);
  return c.json(locs);
});

locationRouter.post("/", authMiddleware, async (c) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const user = c.get("user") as any;
  if (user.role !== 'super_admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only super_admin can create locations' } }, 403);
  }
  const body = await c.req.json();
  const result = await db.insert(locations).values(body).returning();
  return c.json(result[0], 201);
});

export { outletSettingsRouter, locationRouter };
export default outlet;

outlet.post("/", authMiddleware, zValidator("json", createOutletSchema, validatorHook), async (c) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const user = c.get("user") as any;
  if (user.role !== 'super_admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only super_admin can create outlets' } }, 403);
  }
  const data = c.req.valid("json");
  const newOutlet = await createOutlet(db, data, user.sub);
  return c.json(newOutlet, 201);
});

outlet.delete("/:outletId", authMiddleware, async (c) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  const user = c.get("user") as any;
  if (user.role !== 'super_admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only super_admin can delete outlets' } }, 403);
  }
  const outletId = c.req.param("outletId");
  await deleteOutlet(db, outletId, user.sub);
  return c.json({ success: true });
});
