import {
  createSession as createDbSession,
  deleteSession as deleteDbSession,
  getSessionByTokenHash,
  refreshSessionExpiry as refreshDbSessionExpiry,
  type SessionData,
  type SessionRow
} from "./db";
import { addDaysIso } from "./time";

export const SESSION_COOKIE_NAME = "__Host-rsl_dashboard_session";
export const SESSION_DURATION_DAYS = 30;
export const AUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type AuthFlow = "register" | "login";

export type AuthStatePayload = {
  nonce: string;
  iat: number;
  flow: AuthFlow;
  returnTo?: string;
};

export type AuthStateValidationResult =
  | { valid: true; payload: AuthStatePayload }
  | {
      valid: false;
      reason:
        | "missing"
        | "malformed"
        | "tampered"
        | "expired"
        | "unsupported_flow"
        | "invalid_return_to";
    };

export type SessionEnv = {
  ENVIRONMENT?: string;
};

export type SessionStore = {
  createSession(session: SessionData): Promise<SessionRow | null>;
  getSessionByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  deleteSession(sessionId: string): Promise<unknown>;
  refreshSessionExpiry(sessionId: string, expiresAt: string): Promise<SessionRow | null>;
};

export type CreateLocalSessionResult = {
  token: string;
  tokenHash: string;
  expiresAt: string;
  cookie: string;
  session: SessionRow | null;
};

export type SessionValidationResult =
  | { authenticated: true; session: SessionRow; tokenHash: string; cookie: string }
  | { authenticated: false; reason: "missing" | "expired" | "not_found" };

export function createD1SessionStore(db: D1Database): SessionStore {
  return {
    createSession: (session) => createDbSession(db, session),
    getSessionByTokenHash: (tokenHash) => getSessionByTokenHash(db, tokenHash),
    deleteSession: (sessionId) => deleteDbSession(db, sessionId),
    refreshSessionExpiry: (sessionId, expiresAt) => refreshDbSessionExpiry(db, sessionId, expiresAt)
  };
}

export function isProductionSessionEnv(env: SessionEnv) {
  return env.ENVIRONMENT === "production";
}

export function createSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function hashSessionToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

export async function createSignedAuthState(options: {
  flow: AuthFlow;
  secret: string;
  returnTo?: string;
  now?: Date;
}) {
  const issuedAt = options.now?.getTime() ?? Date.now();
  const payload: AuthStatePayload = {
    nonce: createSessionToken(),
    iat: issuedAt,
    flow: options.flow
  };

  if (options.returnTo !== undefined) {
    const returnTo = normalizeReturnTo(options.returnTo);

    if (!returnTo) {
      throw new Error("Invalid returnTo path.");
    }

    payload.returnTo = returnTo;
  }

  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256(encodedPayload, options.secret);

  return `${encodedPayload}.${signature}`;
}

export async function validateSignedAuthState(
  state: string | null | undefined,
  secret: string,
  options: { now?: Date; maxAgeMs?: number } = {}
): Promise<AuthStateValidationResult> {
  if (!state) {
    return { valid: false, reason: "missing" };
  }

  const [encodedPayload, signature, extra] = state.split(".");

  if (!encodedPayload || !signature || extra !== undefined) {
    return { valid: false, reason: "malformed" };
  }

  const expectedSignature = await hmacSha256(encodedPayload, secret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return { valid: false, reason: "tampered" };
  }

  let payload: AuthStatePayload;

  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (payload.flow !== "register" && payload.flow !== "login") {
    return { valid: false, reason: "unsupported_flow" };
  }

  if (typeof payload.nonce !== "string" || payload.nonce.length < 32) {
    return { valid: false, reason: "malformed" };
  }

  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
    return { valid: false, reason: "malformed" };
  }

  if (payload.returnTo !== undefined && !normalizeReturnTo(payload.returnTo)) {
    return { valid: false, reason: "invalid_return_to" };
  }

  const now = options.now?.getTime() ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? AUTH_STATE_TTL_MS;

  if (payload.iat > now || now - payload.iat > maxAgeMs) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}

export function normalizeReturnTo(returnTo: string) {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(returnTo, "http://localhost");

    if (parsed.origin !== "http://localhost") {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function createSessionCookie(
  token: string,
  options: { expiresAt: string; secure?: boolean }
) {
  const cookie = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Secure",
    `Expires=${new Date(options.expiresAt).toUTCString()}`
  ];

  return cookie.join("; ");
}

export function createClearSessionCookie(_options: { secure?: boolean } = {}) {
  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Secure",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0"
  ];

  return cookie.join("; ");
}

export function getSessionTokenFromCookie(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) =>
    cookie.startsWith(`${SESSION_COOKIE_NAME}=`)
  );

  if (!sessionCookie) {
    return null;
  }

  return sessionCookie.slice(SESSION_COOKIE_NAME.length + 1) || null;
}

export async function createLocalSession(
  store: SessionStore,
  userId: string,
  env: SessionEnv,
  now = new Date()
): Promise<CreateLocalSessionResult> {
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = addDaysIso(SESSION_DURATION_DAYS, now);
  const session = await store.createSession({
    userId,
    tokenHash,
    expiresAt
  });
  const cookie = createSessionCookie(token, {
    expiresAt,
    secure: isProductionSessionEnv(env)
  });

  return {
    token,
    tokenHash,
    expiresAt,
    cookie,
    session
  };
}

export async function validateSessionFromRequest(
  store: SessionStore,
  request: Request,
  env: SessionEnv,
  now = new Date()
): Promise<SessionValidationResult> {
  const token = getSessionTokenFromCookie(request.headers.get("Cookie"));

  if (!token) {
    return { authenticated: false, reason: "missing" };
  }

  const tokenHash = await hashSessionToken(token);
  const session = await store.getSessionByTokenHash(tokenHash);

  if (!session) {
    return { authenticated: false, reason: "not_found" };
  }

  if (new Date(session.expires_at).getTime() <= now.getTime()) {
    return { authenticated: false, reason: "expired" };
  }

  const refreshedExpiresAt = addDaysIso(SESSION_DURATION_DAYS, now);
  const refreshedSession =
    (await store.refreshSessionExpiry(session.id, refreshedExpiresAt)) ?? {
      ...session,
      expires_at: refreshedExpiresAt
    };
  const cookie = createSessionCookie(token, {
    expiresAt: refreshedExpiresAt,
    secure: isProductionSessionEnv(env)
  });

  return {
    authenticated: true,
    session: refreshedSession,
    tokenHash,
    cookie
  };
}

export async function deleteSessionFromRequest(
  store: SessionStore,
  request: Request,
  env: SessionEnv
) {
  const token = getSessionTokenFromCookie(request.headers.get("Cookie"));

  if (token) {
    const tokenHash = await hashSessionToken(token);
    const session = await store.getSessionByTokenHash(tokenHash);

    if (session) {
      await store.deleteSession(session.id);
    }
  }

  return createClearSessionCookie({ secure: isProductionSessionEnv(env) });
}

export function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
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

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}
