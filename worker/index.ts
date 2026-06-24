import { Hono } from "hono";
import { serveAssetFallback } from "./lib/assets";
import { notFound } from "./lib/responses";
import { adminRoutes } from "./routes/admin";
import { companyRoutes } from "./routes/company";
import { sessionRoutes } from "./routes/session";

type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
  CLERK_AUTHORIZED_PARTIES?: string;
  CLERK_SECRET_KEY?: string;
  ADMIN_EMAILS?: string;
  DASHBOARD_BASE_URL?: string;
  ENVIRONMENT?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", serveAssetFallback);
app.get("/login/*", serveAssetFallback);
app.get("/login", serveAssetFallback);
app.get("/register/*", serveAssetFallback);
app.get("/register", serveAssetFallback);
app.get("/logout", serveAssetFallback);
app.get("/admin/*", serveAssetFallback);
app.get("/admin", serveAssetFallback);
app.route("/api/session", sessionRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/company", companyRoutes);

app.notFound((c) => {
  const pathname = new URL(c.req.url).pathname;

  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return notFound(c);
  }

  return serveAssetFallback(c);
});

export default app;
