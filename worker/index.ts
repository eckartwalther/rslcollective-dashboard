import { Hono } from "hono";
import { serveAssetFallback } from "./lib/assets";
import { notFound } from "./lib/responses";
import { authRoutes } from "./routes/auth";
import { companyRoutes } from "./routes/company";
import { sessionRoutes } from "./routes/session";

type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
  DASHBOARD_BASE_URL?: string;
  ENVIRONMENT?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_REDIRECT_URI?: string;
  SESSION_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", authRoutes);
app.route("/api/session", sessionRoutes);
app.route("/api/company", companyRoutes);

app.notFound((c) => {
  const pathname = new URL(c.req.url).pathname;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    ["/register", "/login", "/logout"].includes(pathname)
  ) {
    return notFound(c);
  }

  return serveAssetFallback(c);
});

export default app;
