import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { outletMiddleware } from "../../middleware/outlet";
import { requirePermission } from "../../middleware/rbac";
import { transactionSchema, voidTransactionSchema } from "./schema";
import * as txService from "./service";
import { getExportData } from "../report/service";

const transactionRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

transactionRouter.use("*", authMiddleware, outletMiddleware);

// GET /:outlet/transactions - List recent transactions
transactionRouter.get("/", async (c) => {
  try {
    const db = c.get("db");
    const outletId = c.get("outletId");
    const from = c.req.query("from");
    const to = c.req.query("to");
    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 50;

    const data = await getExportData(db, outletId, from, to, page, limit);
    return c.json({ data });
  } catch (error: any) {
    return c.json({ error: { message: error.message } }, 400);
  }
});

// POST /:outlet/transactions - Create new transaction (Checkout)
transactionRouter.post(
  "/",
  requirePermission("transaction:write"),
  zValidator("json", transactionSchema),
  async (c) => {
    try {
      const db = c.get("db");
      const outletId = c.get("outletId");
      const outletSlug = c.req.param("outlet") || "restoran";
      const user = c.get("user");
      const data = c.req.valid("json");

      const result = await txService.createTransaction(
        db,
        outletId,
        outletSlug,
        user.sub,
        data as any
      );

      return c.json({ data: result }, 201);
    } catch (error: any) {
      return c.json({ error: { message: error.message } }, 400);
    }
  }
);

// POST /:outlet/transactions/:id/void - Void transaction
transactionRouter.post(
  "/:id/void",
  requirePermission("transaction:void"),
  zValidator("json", voidTransactionSchema),
  async (c) => {
    try {
      const db = c.get("db");
      const outletId = c.get("outletId");
      const transactionId = c.req.param("id");
      const user = c.get("user");
      const data = c.req.valid("json");

      const result = await txService.voidTransaction(
        db,
        outletId,
        transactionId,
        user.sub,
        data.reason
      );

      return c.json({ data: result });
    } catch (error: any) {
      return c.json({ error: { message: error.message } }, 400);
    }
  }
);

export default transactionRouter;
