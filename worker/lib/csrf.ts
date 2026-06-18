import type { Context } from "hono";
import { forbidden } from "./responses";

const localDevelopmentHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const localDevelopmentPorts = new Set(["8787", "8788"]);
const localDevelopmentProtocols = new Set(["http:", "https:"]);

export type OriginEnv = {
  DASHBOARD_BASE_URL?: string;
  ENVIRONMENT?: string;
};

export type OriginValidationResult =
  | OriginValidationDetails & { valid: true }
  | OriginValidationDetails & { valid: false; reason: "missing_origin" | "mismatched_origin" };

type OriginValidationDetails = {
  productionMode: boolean;
  requestOrigin: string | null;
  normalizedRequestOrigin: string | null;
  dashboardBaseUrl: string | undefined;
  normalizedDashboardOrigin: string | null;
  environment: string | undefined;
};

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

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin);

    return (
      localDevelopmentProtocols.has(url.protocol) &&
      localDevelopmentHosts.has(url.hostname) &&
      localDevelopmentPorts.has(url.port)
    );
  } catch {
    return false;
  }
}

export function isProductionOriginPolicy(env: OriginEnv) {
  return env.ENVIRONMENT === "production";
}

export function validateOrigin(request: Request, env: OriginEnv): OriginValidationResult {
  const requestOrigin = request.headers.get("Origin");
  const normalizedRequestOrigin = originFromUrl(requestOrigin ?? undefined);
  const dashboardOrigin = originFromUrl(env.DASHBOARD_BASE_URL);
  const details: OriginValidationDetails = {
    productionMode: isProductionOriginPolicy(env),
    requestOrigin,
    normalizedRequestOrigin,
    dashboardBaseUrl: env.DASHBOARD_BASE_URL,
    normalizedDashboardOrigin: dashboardOrigin,
    environment: env.ENVIRONMENT
  };

  if (details.productionMode) {
    if (!requestOrigin) {
      return { ...details, valid: false, reason: "missing_origin" };
    }

    if (!dashboardOrigin || normalizedRequestOrigin !== dashboardOrigin) {
      return { ...details, valid: false, reason: "mismatched_origin" };
    }

    return { ...details, valid: true };
  }

  if (!requestOrigin || (normalizedRequestOrigin && isLocalDevelopmentOrigin(normalizedRequestOrigin))) {
    return { ...details, valid: true };
  }

  if (dashboardOrigin && normalizedRequestOrigin === dashboardOrigin) {
    return { ...details, valid: true };
  }

  return { ...details, valid: false, reason: "mismatched_origin" };
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

  logDevelopmentOriginRejection(c, result);

  return forbidden(c, message);
}

function logDevelopmentOriginRejection<T extends OriginEnv>(
  c: Context<{ Bindings: T }>,
  result: Extract<OriginValidationResult, { valid: false }>
) {
  if (result.productionMode) {
    return;
  }

  console.warn(
    JSON.stringify({
      event: "origin_rejected",
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      origin: c.req.header("Origin") ?? null,
      dashboardBaseUrl: result.dashboardBaseUrl,
      environment: result.environment,
      reason: result.reason
    })
  );
}
