import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env, Variables } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { outletMiddleware } from "../../middleware/outlet";
import { requirePermission } from "../../middleware/rbac";
import { voidTransactionSchema } from "./schema";
// void logic will be in Fase 4; route placeholder here
// import * as txService from "./service";

const transactionRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

transactionRouter.use("*", authMiddleware, outletMiddleware);

// POST /:outlet/transactions/:id/void — Fase 4 will implement fully
transactionRouter.post(
  "/:id/void",
  requirePermission("transaction:void"),
  zValidator("json", voidTransactionSchema),
  async (c) => {
    // Placeholder: void logic goes in Fase 4
    return c.json(
      { error: { code: "NOT_IMPLEMENTED", message: "Void will be implemented in Fase 4" } },
      501
    );
  }
);

export default transactionRouter;
