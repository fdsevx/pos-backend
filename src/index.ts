import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./lib/types";
import { errorHandler } from "./middleware/error";
import auth from "./modules/auth/routes";
import outletRouter from "./modules/outlet/routes";
import deviceRouter from "./modules/device/routes";
import categoryRouter from "./modules/category/routes";
import { productRouter, opnameRouter } from "./modules/product/routes";
import discountRouter from "./modules/discount/routes";
import shiftRouter from "./modules/shift/routes";
import transactionRouter from "./modules/transaction/routes";
import syncRouter from "./modules/sync/routes";
import supplierRouter from "./modules/supplier/routes";
import expenseRouter from "./modules/expense/routes";
import purchaseRouter from "./modules/purchase/routes";
import { reportRouter, allReportRouter } from "./modules/report/routes";
import accountingRouter from "./modules/accounting/routes";
import customerRouter from "./modules/customer/routes";
import userRouter from "./modules/user/routes";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global error handler
app.onError(errorHandler);

// CORS
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Content-Encoding", "x-device-id"],
    maxAge: 86400,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.route("/api/v1/auth", auth);
app.route("/api/v1/users", userRouter);
app.route("/api/v1/outlets", outletRouter);
app.route("/api/v1/devices", deviceRouter);

app.route("/api/v1/:outlet/categories", categoryRouter);
app.route("/api/v1/:outlet/products", productRouter);
app.route("/api/v1/:outlet/opname", opnameRouter);
app.route("/api/v1/:outlet/discounts", discountRouter);
app.route("/api/v1/:outlet/shifts", shiftRouter);
app.route("/api/v1/:outlet/transactions", transactionRouter);
app.route("/api/v1/:outlet/sync", syncRouter);
app.route("/api/v1/:outlet/suppliers", supplierRouter);
app.route("/api/v1/:outlet/expenses", expenseRouter);
app.route("/api/v1/:outlet/purchases", purchaseRouter);
app.route("/api/v1/:outlet/reports", reportRouter);
app.route("/api/v1/all/reports", allReportRouter);
app.route("/api/v1/:outlet/accounting", accountingRouter);
app.route("/api/v1/:outlet/customers", customerRouter);

export default app;
