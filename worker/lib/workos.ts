import { WorkOS, type AuthenticationResponse } from "@workos-inc/node/worker";
import { createSignedAuthState, normalizeReturnTo, type AuthFlow } from "./session";

const workosAuthorizeUrl = "https://api.workos.com/user_management/authorize";

export type WorkosAuthEnv = {
  WORKOS_CLIENT_ID?: string;
  WORKOS_REDIRECT_URI?: string;
  WORKOS_API_KEY?: string;
  WORKOS_LOGOUT_URI?: string;
  DASHBOARD_BASE_URL?: string;
  SESSION_SECRET?: string;
  ENVIRONMENT?: string;
};

export type WorkosAuthorizationUrlOptions = {
  flow: AuthFlow;
  returnTo?: string;
};

export async function getWorkosAuthorizationUrl(
  env: WorkosAuthEnv,
  options: WorkosAuthorizationUrlOptions
) {
  assertWorkosAuthConfig(env);
  const redirectUri = getWorkosRedirectUri(env);

  if (!redirectUri) {
    throw new Error("WorkOS authorization is not configured.");
  }

  let returnTo: string | undefined;

  if (options.returnTo !== undefined) {
    const normalizedReturnTo = normalizeReturnTo(options.returnTo);

    if (!normalizedReturnTo) {
      throw new Error("Invalid returnTo path.");
    }

    returnTo = normalizedReturnTo;
  }

  const state = await createSignedAuthState({
    flow: options.flow,
    secret: env.SESSION_SECRET,
    returnTo
  });
  const url = new URL(workosAuthorizeUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.WORKOS_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("provider", "authkit");
  url.searchParams.set("screen_hint", options.flow === "register" ? "sign-up" : "sign-in");
  url.searchParams.set("state", state);

  return url.toString();
}

export function assertWorkosAuthConfig(
  env: WorkosAuthEnv
): asserts env is WorkosAuthEnv & {
  WORKOS_CLIENT_ID: string;
  SESSION_SECRET: string;
} {
  if (!env.WORKOS_CLIENT_ID || !env.SESSION_SECRET || !getWorkosRedirectUri(env)) {
    throw new Error("WorkOS authorization is not configured.");
  }
}

export function getWorkosRedirectUri(env: WorkosAuthEnv) {
  if (env.ENVIRONMENT !== "production" && env.DASHBOARD_BASE_URL) {
    return buildUrl(env.DASHBOARD_BASE_URL, "/auth/callback");
  }

  return env.WORKOS_REDIRECT_URI ?? null;
}

export type WorkosAuthenticatedUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
};

export async function exchangeWorkosAuthorizationCode(env: WorkosAuthEnv, code: string) {
  assertWorkosExchangeConfig(env);
  const workos = new WorkOS(env.WORKOS_API_KEY);

  try {
    const response = await workos.userManagement.authenticateWithCode({
      code,
      clientId: env.WORKOS_CLIENT_ID
    });

    return mapWorkosAuthenticateResponse(response);
  } catch (error) {
    logWorkosExchangeFailure(env, error, code);
    throw new Error("WorkOS authorization code exchange failed.");
  }
}

export function assertWorkosExchangeConfig(
  env: WorkosAuthEnv
): asserts env is WorkosAuthEnv & {
  WORKOS_CLIENT_ID: string;
  WORKOS_API_KEY: string;
  SESSION_SECRET: string;
} {
  if (!env.WORKOS_CLIENT_ID || !env.WORKOS_API_KEY || !env.SESSION_SECRET) {
    throw new Error("WorkOS code exchange is not configured.");
  }
}

export function getWorkosLogoutUrl(env: WorkosAuthEnv) {
  const returnTo = env.WORKOS_LOGOUT_URI ?? env.DASHBOARD_BASE_URL;

  if (!env.WORKOS_CLIENT_ID || !returnTo) {
    return null;
  }

  const url = new URL("https://api.workos.com/user_management/logout");
  url.searchParams.set("client_id", env.WORKOS_CLIENT_ID);
  url.searchParams.set("return_to", returnTo);

  return url.toString();
}

function buildUrl(baseUrl: string, path: string) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

function mapWorkosAuthenticateResponse(response: AuthenticationResponse): WorkosAuthenticatedUser {
  const user = response.user;

  if (!user?.id || !user.email) {
    throw new Error("WorkOS authentication response did not include a user email.");
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    emailVerified: user.emailVerified ?? false
  };
}

function logWorkosExchangeFailure(
  env: WorkosAuthEnv,
  error: unknown,
  code: string
) {
  if (env.ENVIRONMENT === "production") {
    return;
  }

  console.error({
    event: "workos_authorization_code_exchange_failed",
    workosExchangeResponseStatus: getErrorStatus(error),
    workosExchangeResponseStatusText: redactDiagnosticText(getErrorStatusText(error), env, code),
    workosExchangeResponseBody: redactDiagnosticText(getErrorBody(error), env, code),
    workosClientIdPresent: Boolean(env.WORKOS_CLIENT_ID),
    workosClientId: redactClientId(env.WORKOS_CLIENT_ID),
    workosApiKeyPresent: Boolean(env.WORKOS_API_KEY),
    workosRedirectUri: env.WORKOS_REDIRECT_URI
  });
}

function redactClientId(clientId: string | undefined) {
  if (!clientId) {
    return null;
  }

  return `${clientId.slice(0, 12)}...`;
}

function redactValue(value: string, secret: string) {
  if (!secret) {
    return value;
  }

  return value.split(secret).join("[redacted]");
}

function redactDiagnosticText(value: string, env: WorkosAuthEnv, code: string) {
  return redactValue(
    redactValue(redactValue(value, code), env.WORKOS_API_KEY ?? ""),
    env.WORKOS_CLIENT_ID ?? ""
  );
}

function getErrorStatus(error: unknown) {
  return getErrorProperty(error, "status");
}

function getErrorStatusText(error: unknown) {
  const message = getErrorProperty(error, "message");

  return typeof message === "string" ? message : "";
}

function getErrorBody(error: unknown) {
  const rawData = getErrorProperty(error, "rawData");

  if (rawData !== undefined) {
    return stringifyDiagnosticValue(rawData);
  }

  const errorDescription = getErrorProperty(error, "errorDescription");

  if (errorDescription !== undefined) {
    return stringifyDiagnosticValue(errorDescription);
  }

  const message = getErrorProperty(error, "message");

  return typeof message === "string" ? message : "";
}

function getErrorProperty(error: unknown, property: string) {
  if (!error || typeof error !== "object" || !(property in error)) {
    return undefined;
  }

  return (error as Record<string, unknown>)[property];
}

function stringifyDiagnosticValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}
