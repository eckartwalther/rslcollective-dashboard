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
  url.searchParams.set("redirect_uri", env.WORKOS_REDIRECT_URI);
  url.searchParams.set("provider", "authkit");
  url.searchParams.set("screen_hint", options.flow === "register" ? "sign-up" : "sign-in");
  url.searchParams.set("state", state);

  return url.toString();
}

export function assertWorkosAuthConfig(
  env: WorkosAuthEnv
): asserts env is WorkosAuthEnv & {
  WORKOS_CLIENT_ID: string;
  WORKOS_REDIRECT_URI: string;
  SESSION_SECRET: string;
} {
  if (!env.WORKOS_CLIENT_ID || !env.WORKOS_REDIRECT_URI || !env.SESSION_SECRET) {
    throw new Error("WorkOS authorization is not configured.");
  }
}

export type WorkosAuthenticatedUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
};

type WorkosAuthenticateResponse = {
  user?: {
    id?: string;
    email?: string;
    firstName?: string | null;
    first_name?: string | null;
    lastName?: string | null;
    last_name?: string | null;
    emailVerified?: boolean;
    email_verified?: boolean;
  };
};

export async function exchangeWorkosAuthorizationCode(env: WorkosAuthEnv, code: string) {
  assertWorkosExchangeConfig(env);

  const response = await fetch("https://api.workos.com/user_management/authenticate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WORKOS_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: env.WORKOS_CLIENT_ID,
      code,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    const responseBody = await response.text();

    logWorkosExchangeFailure(env, response, responseBody, code);

    throw new Error("WorkOS authorization code exchange failed.");
  }

  return mapWorkosAuthenticateResponse((await response.json()) as WorkosAuthenticateResponse);
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

function mapWorkosAuthenticateResponse(response: WorkosAuthenticateResponse): WorkosAuthenticatedUser {
  const user = response.user;

  if (!user?.id || !user.email) {
    throw new Error("WorkOS authentication response did not include a user email.");
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? user.first_name ?? null,
    lastName: user.lastName ?? user.last_name ?? null,
    emailVerified: user.emailVerified ?? user.email_verified ?? false
  };
}

function logWorkosExchangeFailure(
  env: WorkosAuthEnv,
  response: Response,
  responseBody: string,
  code: string
) {
  if (env.ENVIRONMENT === "production") {
    return;
  }

  console.error({
    event: "workos_authorization_code_exchange_failed",
    workosExchangeResponseStatus: response.status,
    workosExchangeResponseStatusText: response.statusText,
    workosExchangeResponseBody: redactWorkosExchangeBody(responseBody, env, code),
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

function redactWorkosExchangeBody(value: string, env: WorkosAuthEnv, code: string) {
  return redactValue(redactValue(value, code), env.WORKOS_API_KEY ?? "");
}
