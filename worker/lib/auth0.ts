import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { createSignedAuthState, normalizeReturnTo, type AuthFlow } from "./session";

export const AUTH0_PROVIDER = "auth0";
export const AUTH0_CLOCK_TOLERANCE_SECONDS = 60;

export type Auth0AuthEnv = {
  AUTH0_ISSUER_BASE_URL?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;
  AUTH0_CALLBACK_URL?: string;
  DASHBOARD_BASE_URL?: string;
  SESSION_SECRET?: string;
  ENVIRONMENT?: string;
};

export type Auth0AuthorizationUrlOptions = {
  flow: AuthFlow;
  returnTo?: string;
};

export type Auth0AuthenticatedUser = {
  authProvider: typeof AUTH0_PROVIDER;
  authSubject: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified: true;
};

export type Auth0AuthErrorCode =
  | "token_exchange_failed"
  | "token_response_missing_id_token"
  | "jwks_signature_validation_failed"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "token_expired"
  | "token_exp_missing"
  | "token_iat_missing"
  | "token_iat_invalid"
  | "nonce_mismatch"
  | "missing_sub"
  | "missing_email"
  | "email_unverified";

export class Auth0AuthError extends Error {
  constructor(
    readonly code: Auth0AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "Auth0AuthError";
  }
}

export function isAuth0AuthError(error: unknown): error is Auth0AuthError {
  return error instanceof Auth0AuthError;
}

type Auth0TokenResponse = {
  id_token?: unknown;
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
};

type Auth0TokenClaims = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  exp?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  iat?: unknown;
  nonce?: unknown;
};

export async function getAuth0AuthorizationUrl(
  env: Auth0AuthEnv,
  options: Auth0AuthorizationUrlOptions
) {
  assertAuth0AuthorizationConfig(env);

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
  const url = auth0EndpointUrl(env, "/authorize");
  const callbackUrl = getAuth0CallbackUrl(env);

  if (!callbackUrl) {
    throw new Error("Auth0 authorization is not configured.");
  }

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.AUTH0_CLIENT_ID);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);

  const nonce = extractNonceFromSignedStateForAuthorize(state);

  if (nonce) {
    url.searchParams.set("nonce", nonce);
  }

  if (options.flow === "register") {
    url.searchParams.set("screen_hint", "signup");
  }

  return url.toString();
}

export function assertAuth0AuthorizationConfig(
  env: Auth0AuthEnv
): asserts env is Auth0AuthEnv & {
  AUTH0_ISSUER_BASE_URL: string;
  AUTH0_CLIENT_ID: string;
  SESSION_SECRET: string;
} {
  if (
    !env.AUTH0_ISSUER_BASE_URL ||
    !env.AUTH0_CLIENT_ID ||
    !env.SESSION_SECRET ||
    !getAuth0CallbackUrl(env)
  ) {
    throw new Error("Auth0 authorization is not configured.");
  }
}

export async function exchangeAuth0AuthorizationCode(
  env: Auth0AuthEnv,
  code: string,
  nonce: string
) {
  assertAuth0ExchangeConfig(env);
  const redirectUri = getAuth0CallbackUrl(env);

  if (!redirectUri) {
    throw new Error("Auth0 code exchange is not configured.");
  }

  let response: Response;

  try {
    response = await fetch(auth0EndpointUrl(env, "/oauth/token"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.AUTH0_CLIENT_ID,
        client_secret: env.AUTH0_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      })
    });
  } catch (error) {
    logAuth0ExchangeFailure(env, error, code);
    throw new Auth0AuthError(
      "token_exchange_failed",
      "Auth0 authorization code exchange failed."
    );
  }

  const bodyText = await response.text();

  if (!response.ok) {
    logAuth0ExchangeFailure(env, { status: response.status, body: bodyText }, code);
    throw new Auth0AuthError(
      "token_exchange_failed",
      "Auth0 authorization code exchange failed."
    );
  }

  let tokenResponse: Auth0TokenResponse;

  try {
    tokenResponse = JSON.parse(bodyText) as Auth0TokenResponse;
  } catch (error) {
    logAuth0ExchangeFailure(env, error, code);
    throw new Auth0AuthError(
      "token_exchange_failed",
      "Auth0 authorization code exchange failed."
    );
  }

  if (typeof tokenResponse.id_token !== "string") {
    throw new Auth0AuthError(
      "token_response_missing_id_token",
      "Auth0 token response did not include an ID token."
    );
  }

  return validateAuth0IdToken(env, tokenResponse.id_token, nonce);
}

export function assertAuth0ExchangeConfig(
  env: Auth0AuthEnv
): asserts env is Auth0AuthEnv & {
  AUTH0_ISSUER_BASE_URL: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  SESSION_SECRET: string;
} {
  if (
    !env.AUTH0_ISSUER_BASE_URL ||
    !env.AUTH0_CLIENT_ID ||
    !env.AUTH0_CLIENT_SECRET ||
    !env.SESSION_SECRET
  ) {
    throw new Error("Auth0 code exchange is not configured.");
  }
}

export async function validateAuth0IdToken(
  env: Auth0AuthEnv,
  idToken: string,
  nonce: string,
  keySet: JWTVerifyGetKey = createRemoteJWKSet(auth0EndpointUrl(env, "/.well-known/jwks.json"))
) {
  assertAuth0TokenValidationConfig(env);
  const issuer = getAuth0Issuer(env);

  if (!issuer) {
    throw new Error("Auth0 token validation is not configured.");
  }

  const result = await verifyAuth0Jwt(idToken, keySet, {
    issuer,
    audience: env.AUTH0_CLIENT_ID
  });
  const claims = result.payload as Auth0TokenClaims;
  validateTokenTimingClaims(claims);

  if (claims.nonce !== nonce) {
    throw new Auth0AuthError("nonce_mismatch", "Auth0 ID token nonce did not match.");
  }

  if (typeof claims.sub !== "string" || !claims.sub) {
    throw new Auth0AuthError("missing_sub", "Auth0 ID token did not include a subject.");
  }

  if (typeof claims.email !== "string" || !claims.email) {
    throw new Auth0AuthError("missing_email", "Auth0 ID token did not include an email.");
  }

  if (claims.email_verified !== true) {
    throw new Auth0AuthError("email_unverified", "Auth0 ID token email is not verified.");
  }

  return {
    authProvider: AUTH0_PROVIDER,
    authSubject: claims.sub,
    email: claims.email,
    firstName: typeof claims.given_name === "string" ? claims.given_name : null,
    lastName: typeof claims.family_name === "string" ? claims.family_name : null,
    emailVerified: true
  } satisfies Auth0AuthenticatedUser;
}

function validateTokenTimingClaims(claims: Auth0TokenClaims) {
  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) {
    throw new Auth0AuthError("token_exp_missing", "Auth0 ID token did not include an expiration.");
  }

  if (typeof claims.iat !== "number" || !Number.isFinite(claims.iat)) {
    throw new Auth0AuthError("token_iat_missing", "Auth0 ID token did not include an issued-at time.");
  }

  const maxIssuedAt = Math.floor(Date.now() / 1000) + AUTH0_CLOCK_TOLERANCE_SECONDS;

  if (claims.iat > maxIssuedAt) {
    throw new Auth0AuthError("token_iat_invalid", "Auth0 ID token issued-at time is in the future.");
  }
}

async function verifyAuth0Jwt(
  idToken: string,
  keySet: JWTVerifyGetKey,
  options: { issuer: string; audience: string }
) {
  try {
    return await jwtVerify(idToken, keySet, {
      issuer: options.issuer,
      audience: options.audience,
      algorithms: ["RS256"],
      clockTolerance: AUTH0_CLOCK_TOLERANCE_SECONDS
    });
  } catch (error) {
    throw classifyJwtVerificationError(error);
  }
}

function classifyJwtVerificationError(error: unknown) {
  const code = getJoseErrorCode(error);
  const claim = getJoseErrorClaim(error);

  if (code === "ERR_JWT_EXPIRED") {
    return new Auth0AuthError("token_expired", "Auth0 ID token is expired.");
  }

  if (claim === "iss") {
    return new Auth0AuthError("issuer_mismatch", "Auth0 ID token issuer did not match.");
  }

  if (claim === "aud") {
    return new Auth0AuthError("audience_mismatch", "Auth0 ID token audience did not match.");
  }

  return new Auth0AuthError(
    "jwks_signature_validation_failed",
    "Auth0 ID token signature or claims could not be verified."
  );
}

function getJoseErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

function getJoseErrorClaim(error: unknown) {
  if (typeof error === "object" && error !== null && "claim" in error) {
    const claim = (error as { claim?: unknown }).claim;
    return typeof claim === "string" ? claim : null;
  }

  return null;
}

export function assertAuth0TokenValidationConfig(
  env: Auth0AuthEnv
): asserts env is Auth0AuthEnv & {
  AUTH0_ISSUER_BASE_URL: string;
  AUTH0_CLIENT_ID: string;
} {
  if (!env.AUTH0_ISSUER_BASE_URL || !env.AUTH0_CLIENT_ID) {
    throw new Error("Auth0 token validation is not configured.");
  }
}

export function getAuth0LogoutUrl(env: Auth0AuthEnv) {
  assertAuth0LogoutConfig(env);
  const returnTo = buildLogoutReturnTo(env);

  if (!returnTo) {
    return null;
  }

  const url = auth0EndpointUrl(env, "/v2/logout");
  url.searchParams.set("client_id", env.AUTH0_CLIENT_ID);
  url.searchParams.set("returnTo", returnTo);

  return url.toString();
}

export function assertAuth0LogoutConfig(
  env: Auth0AuthEnv
): asserts env is Auth0AuthEnv & {
  AUTH0_ISSUER_BASE_URL: string;
  AUTH0_CLIENT_ID: string;
} {
  if (!env.AUTH0_ISSUER_BASE_URL || !env.AUTH0_CLIENT_ID) {
    throw new Error("Auth0 logout is not configured.");
  }
}

export function getAuth0CallbackUrl(env: Auth0AuthEnv) {
  if (env.AUTH0_CALLBACK_URL) {
    return buildUrl(env.AUTH0_CALLBACK_URL, "");
  }

  if (env.DASHBOARD_BASE_URL) {
    return buildUrl(env.DASHBOARD_BASE_URL, "/auth/callback");
  }

  return null;
}

export function getAuth0Issuer(env: Auth0AuthEnv) {
  const issuerBase = normalizeIssuerBaseUrl(env.AUTH0_ISSUER_BASE_URL);
  return issuerBase ? `${issuerBase}/` : null;
}

export function auth0EndpointUrl(env: Auth0AuthEnv, path: string) {
  const issuerBase = normalizeIssuerBaseUrl(env.AUTH0_ISSUER_BASE_URL);

  if (!issuerBase) {
    throw new Error("Auth0 issuer is not configured.");
  }

  return new URL(path, `${issuerBase}/`);
}

function normalizeIssuerBaseUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function buildUrl(baseUrl: string, path: string) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

function buildLogoutReturnTo(env: Auth0AuthEnv) {
  if (!env.DASHBOARD_BASE_URL) {
    return null;
  }

  return buildUrl(env.DASHBOARD_BASE_URL, "/login");
}

function extractNonceFromSignedStateForAuthorize(state: string) {
  try {
    const [payload] = state.split(".");

    if (!payload) {
      return null;
    }

    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as {
      nonce?: unknown;
    };

    return typeof decoded.nonce === "string" ? decoded.nonce : null;
  } catch {
    return null;
  }
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function logAuth0ExchangeFailure(env: Auth0AuthEnv, error: unknown, code: string) {
  if (env.ENVIRONMENT === "production") {
    return;
  }

  console.error({
    event: "auth0_authorization_code_exchange_failed",
    auth0ExchangeResponseStatus: getErrorStatus(error),
    auth0ExchangeResponseBody: redactDiagnosticText(getErrorBody(error), env, code),
    auth0ClientIdPresent: Boolean(env.AUTH0_CLIENT_ID),
    auth0ClientId: redactClientId(env.AUTH0_CLIENT_ID),
    auth0ClientSecretPresent: Boolean(env.AUTH0_CLIENT_SECRET),
    auth0IssuerBaseUrl: env.AUTH0_ISSUER_BASE_URL,
    auth0CallbackUrl: getAuth0CallbackUrl(env)
  });
}

function getErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }

  return null;
}

function getErrorBody(error: unknown) {
  if (typeof error === "object" && error !== null && "body" in error) {
    const body = (error as { body?: unknown }).body;
    return typeof body === "string" ? body : JSON.stringify(body);
  }

  return error instanceof Error ? error.message : String(error);
}

function redactDiagnosticText(value: string, env: Auth0AuthEnv, code: string) {
  return redactValue(
    redactValue(redactValue(value, code), env.AUTH0_CLIENT_SECRET ?? ""),
    env.AUTH0_CLIENT_ID ?? ""
  );
}

function redactValue(value: string, secret: string) {
  return secret ? value.split(secret).join("[redacted]") : value;
}

function redactClientId(clientId: string | undefined) {
  return clientId ? `${clientId.slice(0, 12)}...` : null;
}
