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
app.route("/api/v1/outlets", outletRouter);
app.route("/api/v1/devices", deviceRouter);

app.route("/api/v1/:outlet/categories", categoryRouter);
app.route("/api/v1/:outlet/products", productRouter);
app.route("/api/v1/:outlet/opname", opnameRouter);
app.route("/api/v1/:outlet/discounts", discountRouter);

export default app;
