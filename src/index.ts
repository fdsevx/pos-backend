import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./lib/types";
import { errorHandler } from "./middleware/error";
import auth from "./modules/auth/routes";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global error handler
app.onError(errorHandler);

// CORS
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Content-Encoding"],
    maxAge: 86400,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes
app.route("/api/v1/auth", auth);

export default app;
