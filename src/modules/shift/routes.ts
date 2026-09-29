import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { outletMiddleware } from "../../middleware/outlet";
import { requirePermission } from "../../middleware/rbac";
import { openShiftSchema, closeShiftSchema } from "./schema";
import * as shiftService from "./service";

const shiftRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

shiftRouter.use("*", authMiddleware, outletMiddleware);

shiftRouter.post(
  "/open",
  requirePermission("shift:write"),
  zValidator("json", openShiftSchema),
  async (c) => {
    const user = c.get("user");
    const outletId = c.get("outletId");
    const data = c.req.valid("json");
    try {
      const shift = await shiftService.openShift(
        c.get("db"),
        outletId,
        user.sub,
        data
      );
      return c.json({ success: true, data: shift }, 201);
    } catch (err: any) {
      return c.json(
        { error: { code: "SHIFT_ERROR", message: err.message } },
        400
      );
    }
  }
);

shiftRouter.post(
  "/close",
  requirePermission("shift:write"),
  zValidator("json", closeShiftSchema),
  async (c) => {
    const user = c.get("user");
    const outletId = c.get("outletId");
    const outletSlug = c.req.param("outlet") ?? "restoran";
    const data = c.req.valid("json");
    try {
      const shift = await shiftService.closeShift(
        c.get("db"),
        outletId,
        outletSlug,
        user.sub,
        data
      );
      return c.json({ success: true, data: shift });
    } catch (err: any) {
      return c.json(
        { error: { code: "SHIFT_ERROR", message: err.message } },
        400
      );
    }
  }
);

export default shiftRouter;
