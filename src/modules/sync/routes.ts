import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Env, Variables } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { outletMiddleware } from "../../middleware/outlet";
import { outlets } from "../../db/schema";
import { syncBatchSchema, pullQuerySchema } from "./schema";
import * as syncService from "./service";

const syncRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

syncRouter.use("*", authMiddleware, outletMiddleware);

/**
 * POST /:outlet/sync
 * Batch sync: transactions, expenses, shifts, voids.
 * Supports Content-Encoding: gzip (handled by Workers runtime via DecompressionStream).
 * Max 25 items per batch.
 */
syncRouter.post(
  "/",
  zValidator("json", syncBatchSchema),
  async (c) => {
    const user = c.get("user");
    const outletId = c.get("outletId");
    const db = c.get("db");

    // Check outlet is_active
    const [outlet] = await db
      .select({ is_active: outlets.is_active, slug: outlets.slug })
      .from(outlets)
      .where(eq(outlets.id, outletId))
      .limit(1);

    if (!outlet?.is_active) {
      return c.json(
        { error: { code: "OUTLET_INACTIVE", message: "Outlet is inactive" } },
        403
      );
    }

    const { items } = c.req.valid("json");
    const results = [];

    // Process each item independently
    for (const item of items) {
      const result = await syncService.processSyncItem(
        db,
        outletId,
        outlet.slug,
        user.sub,
        item
      );
      results.push(result);
    }

    return c.json({ results });
  }
);

/**
 * GET /:outlet/sync/pull
 * Pull menu, prices, stock, discounts, tombstones for Flutter sync.
 * ?since=ISO&cursor=&limit=50&bootstrap=false
 */
syncRouter.get("/pull", async (c) => {
  const outletId = c.get("outletId");
  const db = c.get("db");

  const query = pullQuerySchema.parse({
    since: c.req.query("since"),
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    bootstrap: c.req.query("bootstrap"),
  });

  const data = await syncService.pullData(db, outletId, query);

  return c.json(data);
});

export default syncRouter;
