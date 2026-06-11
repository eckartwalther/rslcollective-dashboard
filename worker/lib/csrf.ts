import type { Context } from "hono";
import { forbidden } from "./responses";

const localDevelopmentOrigin = "http://localhost:8787";

export type OriginEnv = {
  DASHBOARD_BASE_URL?: string;
  ENVIRONMENT?: string;
};

export type OriginValidationResult =
  | { valid: true }
  | { valid: false; reason: "missing_origin" | "mismatched_origin" };

function originFromUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isProductionOriginPolicy(env: OriginEnv) {
  return env.ENVIRONMENT === "production";
}

export function validateOrigin(request: Request, env: OriginEnv): OriginValidationResult {
  const requestOrigin = request.headers.get("Origin");
  const dashboardOrigin = originFromUrl(env.DASHBOARD_BASE_URL);

  if (isProductionOriginPolicy(env)) {
    if (!requestOrigin) {
      return { valid: false, reason: "missing_origin" };
    }

    if (!dashboardOrigin || requestOrigin !== dashboardOrigin) {
      return { valid: false, reason: "mismatched_origin" };
    }

    return { valid: true };
  }

  if (!requestOrigin || requestOrigin === localDevelopmentOrigin) {
    return { valid: true };
  }

  if (dashboardOrigin && requestOrigin === dashboardOrigin) {
    return { valid: true };
  }

  return { valid: false, reason: "mismatched_origin" };
}

export function requireValidOrigin<T extends OriginEnv>(c: Context<{ Bindings: T }>) {
  const result = validateOrigin(c.req.raw, c.env);

  if (result.valid) {
    return null;
  }

  const message =
    result.reason === "missing_origin"
      ? "Origin header is required."
      : "Request origin is not allowed.";

  return forbidden(c, message);
}
