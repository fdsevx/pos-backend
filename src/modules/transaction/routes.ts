import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { outletMiddleware } from "../../middleware/outlet";
import { requirePermission } from "../../middleware/rbac";
import { voidTransactionSchema } from "./schema";
import * as txService from "./service";

const transactionRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

transactionRouter.use("*", authMiddleware, outletMiddleware);

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
