import type { Context } from "hono";

type AssetBindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

export function serveAssetFallback(c: Context<{ Bindings: AssetBindings }>) {
  return c.env.ASSETS.fetch(c.req.raw);
}
