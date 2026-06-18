import {
  createClearSessionCookie,
  createLocalSession,
  createSessionCookie,
  DEVELOPMENT_SESSION_COOKIE_NAME,
  deleteSessionFromRequest,
  getSessionTokenFromCookie,
  hashSessionToken,
  normalizeReturnTo,
  SESSION_COOKIE_NAME,
  type SessionStore
} from "../worker/lib/session";
import type { SessionData, SessionRow } from "../worker/lib/db";

function createSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "ses_test",
    user_id: "usr_test",
    token_hash: "hash_test",
    csrf_token_hash: null,
    workos_session_id: null,
    expires_at: "2026-07-11T00:00:00.000Z",
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides
  };
}

function createStore(session: SessionRow | null = null) {
  const captured: {
    created?: SessionData;
    deletedSessionId?: string;
    refreshed?: { sessionId: string; expiresAt: string };
  } = {};

  const store: SessionStore = {
    createSession: async (data) => {
      captured.created = data;
      session = createSessionRow({
        user_id: data.userId,
        token_hash: data.tokenHash,
        csrf_token_hash: data.csrfTokenHash ?? null,
        workos_session_id: data.workosSessionId ?? null,
        expires_at: data.expiresAt
      });
      return session;
    },
    getSessionByTokenHash: async (tokenHash) =>
      session?.token_hash === tokenHash ? session : null,
    deleteSession: async (sessionId) => {
      captured.deletedSessionId = sessionId;
      session = null;
    },
    refreshSessionExpiry: async (sessionId, expiresAt) => {
      captured.refreshed = { sessionId, expiresAt };
      session = session ? { ...session, expires_at: expiresAt } : null;
      return session;
    }
  };

  return { store, captured };
}

describe("session utilities", () => {
  it("hashes tokens without returning the raw token", async () => {
    const token = "opaque-session-token";
    const hash = await hashSessionToken(token);

    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("stores only the token hash when creating a local session", async () => {
    const { store, captured } = createStore();
    const result = await createLocalSession(
      store,
      "usr_test",
      { ENVIRONMENT: "development" },
      "workos_session_test",
      new Date("2026-06-11T00:00:00.000Z")
    );

    expect(captured.created).toEqual({
      userId: "usr_test",
      tokenHash: result.tokenHash,
      workosSessionId: "workos_session_test",
      expiresAt: "2026-07-11T00:00:00.000Z"
    });
    expect(captured.created).not.toHaveProperty("token");
    expect(captured.created?.tokenHash).not.toBe(result.token);
  });

  it("accepts valid sessions and refreshes rolling expiry", async () => {
    const token = "valid-token";
    const tokenHash = await hashSessionToken(token);
    const { store, captured } = createStore(createSessionRow({ token_hash: tokenHash }));
    const request = new Request("https://dashboard.rslcollective.org/api/session", {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` }
    });
    const { validateSessionFromRequest } = await import("../worker/lib/session");
    const result = await validateSessionFromRequest(
      store,
      request,
      { ENVIRONMENT: "production" },
      new Date("2026-06-11T00:00:00.000Z")
    );

    expect(result.authenticated).toBe(true);
    expect(captured.refreshed).toEqual({
      sessionId: "ses_test",
      expiresAt: "2026-07-11T00:00:00.000Z"
    });
    expect(result.authenticated && result.cookie).toContain("Secure");
  });

  it("rejects expired sessions", async () => {
    const token = "expired-token";
    const tokenHash = await hashSessionToken(token);
    const { store, captured } = createStore(
      createSessionRow({
        token_hash: tokenHash,
        expires_at: "2026-06-10T23:59:59.000Z"
      })
    );
    const request = new Request("https://dashboard.rslcollective.org/api/session", {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` }
    });
    const { validateSessionFromRequest } = await import("../worker/lib/session");
    const result = await validateSessionFromRequest(
      store,
      request,
      { ENVIRONMENT: "production" },
      new Date("2026-06-11T00:00:00.000Z")
    );

    expect(result).toEqual({ authenticated: false, reason: "expired" });
    expect(captured.refreshed).toBeUndefined();
  });

  it("creates a production __Host- session cookie with required attributes and no Domain", () => {
    const cookie = createSessionCookie("token", {
      expiresAt: "2026-07-11T00:00:00.000Z",
      env: { ENVIRONMENT: "production" }
    });

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
  });

  it("creates a development session cookie without Secure", () => {
    const cookie = createSessionCookie("token", {
      expiresAt: "2026-07-11T00:00:00.000Z",
      env: { ENVIRONMENT: "development" }
    });

    expect(cookie).toContain(`${DEVELOPMENT_SESSION_COOKIE_NAME}=token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure");
    expect(cookie).not.toContain("Domain=");
    expect(cookie).not.toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("reads the development session cookie in development", () => {
    expect(
      getSessionTokenFromCookie(
        `${DEVELOPMENT_SESSION_COOKIE_NAME}=dev-token; ${SESSION_COOKIE_NAME}=prod-token`,
        { ENVIRONMENT: "development" }
      )
    ).toBe("dev-token");
  });

  it("falls back to the production session cookie only in development", () => {
    expect(
      getSessionTokenFromCookie(`${SESSION_COOKIE_NAME}=prod-token`, {
        ENVIRONMENT: "development"
      })
    ).toBe("prod-token");
  });

  it("reads only the production session cookie in production", () => {
    expect(
      getSessionTokenFromCookie(
        `${DEVELOPMENT_SESSION_COOKIE_NAME}=dev-token; ${SESSION_COOKIE_NAME}=prod-token`,
        { ENVIRONMENT: "production" }
      )
    ).toBe("prod-token");
    expect(
      getSessionTokenFromCookie(`${DEVELOPMENT_SESSION_COOKIE_NAME}=dev-token`, {
        ENVIRONMENT: "production"
      })
    ).toBeNull();
  });

  it("normalizes returnTo paths without using the production dashboard host", () => {
    expect(normalizeReturnTo("/dashboard/company?tab=profile#top")).toBe(
      "/dashboard/company?tab=profile#top"
    );
    expect(normalizeReturnTo("https://dashboard.rslcollective.org/dashboard/company")).toBeNull();
    expect(normalizeReturnTo("//dashboard.rslcollective.org/dashboard/company")).toBeNull();
  });

  it("deletes sessions and returns a clearing cookie", async () => {
    const token = "logout-token";
    const tokenHash = await hashSessionToken(token);
    const { store, captured } = createStore(createSessionRow({ token_hash: tokenHash }));
    const request = new Request("https://dashboard.rslcollective.org/logout", {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` }
    });
    const result = await deleteSessionFromRequest(store, request, { ENVIRONMENT: "production" });
    const cookie = result.cookies.join(", ");

    expect(captured.deletedSessionId).toBe("ses_test");
    expect(result.session?.id).toBe("ses_test");
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });

  it("creates a production Secure clearing cookie without a Domain attribute", () => {
    const cookie = createClearSessionCookie({ ENVIRONMENT: "production" });

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });

  it("creates a development clearing cookie without Secure", () => {
    const cookie = createClearSessionCookie({ ENVIRONMENT: "development" });

    expect(cookie).toContain(`${DEVELOPMENT_SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });

  it("clears both development and stale production cookies in development logout", async () => {
    const token = "logout-token";
    const tokenHash = await hashSessionToken(token);
    const { store, captured } = createStore(createSessionRow({ token_hash: tokenHash }));
    const request = new Request("http://localhost:8787/logout", {
      headers: { Cookie: `${DEVELOPMENT_SESSION_COOKIE_NAME}=${token}` }
    });
    const result = await deleteSessionFromRequest(store, request, { ENVIRONMENT: "development" });
    const cookies = result.cookies;

    expect(captured.deletedSessionId).toBe("ses_test");
    expect(result.session?.id).toBe("ses_test");
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain(`${DEVELOPMENT_SESSION_COOKIE_NAME}=`);
    expect(cookies[0]).not.toContain("Secure");
    expect(cookies[1]).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookies[1]).toContain("Secure");
  });
});
