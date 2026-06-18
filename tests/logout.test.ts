import { createAuthRoutes, type AuthRouteDeps } from "../worker/routes/auth";
import {
  DEVELOPMENT_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  hashSessionToken,
  type SessionStore
} from "../worker/lib/session";
import type { SessionData, SessionRow, UserRow, WorkosUserData } from "../worker/lib/db";
import type { WorkosAuthEnv, WorkosAuthenticatedUser } from "../worker/lib/workos";

const productionEnv = {
  ENVIRONMENT: "production",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  WORKOS_CLIENT_ID: "client_test",
  SESSION_SECRET: "test-session-secret",
  DB: {} as D1Database
};

function createSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "ses_logout",
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

function createHarness(options: {
  session?: SessionRow | null;
  logoutUrl?: string | null;
} = {}) {
  let session = options.session ?? null;
  const calls = {
    deletedSessionId: null as string | null,
    logoutSessionId: null as string | null
  };
  const sessionStore: SessionStore = {
    createSession: async (_session: SessionData) => null,
    getSessionByTokenHash: async (tokenHash) =>
      session?.token_hash === tokenHash ? session : null,
    deleteSession: async (sessionId) => {
      calls.deletedSessionId = sessionId;
      session = null;
    },
    refreshSessionExpiry: async () => session
  };
  const deps: AuthRouteDeps = {
    createSessionStore: () => sessionStore,
    exchangeAuthorizationCode: async (_env: WorkosAuthEnv, _code: string): Promise<WorkosAuthenticatedUser> => {
      throw new Error("Not used in logout tests.");
    },
    getUserByWorkosUserId: async () => null,
    createUserFromWorkos: async (_db: D1Database, _user: WorkosUserData): Promise<UserRow | null> =>
      null,
    updateUserFromWorkos: async (_db: D1Database, _user: WorkosUserData): Promise<UserRow | null> =>
      null,
    getLogoutUrl: (_env, sessionId) => {
      calls.logoutSessionId = sessionId ?? null;
      return options.logoutUrl ?? null;
    }
  };

  return {
    calls,
    routes: createAuthRoutes(deps)
  };
}

async function logoutRequest(
  routes: ReturnType<typeof createAuthRoutes>,
  options: { env?: Record<string, unknown>; headers?: HeadersInit } = {}
) {
  return routes.fetch(
    new Request("https://dashboard.rslcollective.org/logout", {
      method: "POST",
      headers: options.headers
    }),
    options.env ?? productionEnv
  );
}

describe("POST /logout", () => {
  it("rejects invalid Origin in production", async () => {
    const { routes } = createHarness();
    const response = await logoutRequest(routes, {
      headers: { Origin: "https://example.com" }
    });

    expect(response.status).toBe(403);
  });

  it("rejects missing Origin in production", async () => {
    const { routes } = createHarness();
    const response = await logoutRequest(routes);

    expect(response.status).toBe(403);
  });

  it("accepts matching DASHBOARD_BASE_URL Origin in production", async () => {
    const { routes } = createHarness({
      logoutUrl: "https://api.workos.com/user_management/logout?client_id=client_test"
    });
    const response = await logoutRequest(routes, {
      headers: { Origin: "https://dashboard.rslcollective.org" }
    });

    expect(response.status).toBe(302);
  });

  it("accepts localhost Origin in development", async () => {
    const { routes } = createHarness();
    const response = await logoutRequest(routes, {
      env: { ENVIRONMENT: "development", DB: {} as D1Database },
      headers: { Origin: "http://localhost:8787" }
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  it("clears the development cookie without Secure in development", async () => {
    const { routes } = createHarness();
    const response = await logoutRequest(routes, {
      env: { ENVIRONMENT: "development", DB: {} as D1Database },
      headers: { Origin: "http://localhost:8787" }
    });
    const cookie = response.headers.get("Set-Cookie");

    expect(cookie).toContain(`${DEVELOPMENT_SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("Domain=");
  });

  it("also clears a stale production cookie in development", async () => {
    const { routes } = createHarness();
    const response = await logoutRequest(routes, {
      env: { ENVIRONMENT: "development", DB: {} as D1Database },
      headers: { Origin: "http://localhost:8787" }
    });
    const cookie = response.headers.get("Set-Cookie");

    expect(cookie).toContain(`${DEVELOPMENT_SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("invalidates the local D1 session when a session cookie is present", async () => {
    const token = "logout-token";
    const tokenHash = await hashSessionToken(token);
    const { routes, calls } = createHarness({
      session: createSessionRow({ token_hash: tokenHash }),
      logoutUrl: "https://api.workos.com/user_management/logout?client_id=client_test"
    });
    const response = await logoutRequest(routes, {
      headers: {
        Origin: "https://dashboard.rslcollective.org",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`
      }
    });

    expect(response.status).toBe(302);
    expect(calls.deletedSessionId).toBe("ses_logout");
  });

  it("still clears the cookie if no valid local session exists", async () => {
    const { routes, calls } = createHarness({
      logoutUrl: "https://api.workos.com/user_management/logout?client_id=client_test",
      session: null
    });
    const response = await logoutRequest(routes, {
      headers: {
        Origin: "https://dashboard.rslcollective.org",
        Cookie: `${SESSION_COOKIE_NAME}=unknown`
      }
    });

    expect(response.status).toBe(302);
    expect(calls.deletedSessionId).toBeNull();
    expect(response.headers.get("Set-Cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("clears __Host-rsl_dashboard_session with required attributes", async () => {
    const { routes } = createHarness({
      logoutUrl: "https://api.workos.com/user_management/logout?client_id=client_test"
    });
    const response = await logoutRequest(routes, {
      headers: { Origin: "https://dashboard.rslcollective.org" }
    });
    const cookie = response.headers.get("Set-Cookie");

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("Domain=");
  });

  it("invalidates the local D1 session from a development cookie when present", async () => {
    const token = "dev-logout-token";
    const tokenHash = await hashSessionToken(token);
    const { routes, calls } = createHarness({
      session: createSessionRow({ token_hash: tokenHash }),
      logoutUrl: null
    });
    const response = await logoutRequest(routes, {
      env: { ENVIRONMENT: "development", DB: {} as D1Database },
      headers: {
        Origin: "http://localhost:8787",
        Cookie: `${DEVELOPMENT_SESSION_COOKIE_NAME}=${token}`
      }
    });

    expect(response.status).toBe(302);
    expect(calls.deletedSessionId).toBe("ses_logout");
  });

  it("redirects through WorkOS logout URL when available", async () => {
    const logoutUrl = "https://api.workos.com/user_management/logout?client_id=client_test";
    const { routes } = createHarness({ logoutUrl });
    const response = await logoutRequest(routes, {
      headers: { Origin: "https://dashboard.rslcollective.org" }
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(logoutUrl);
  });

  it("falls back to /login when no WorkOS session ID is stored", async () => {
    const token = "legacy-logout-token";
    const tokenHash = await hashSessionToken(token);
    const { routes, calls } = createHarness({
      session: createSessionRow({ token_hash: tokenHash, workos_session_id: null }),
      logoutUrl: null
    });
    const response = await logoutRequest(routes, {
      headers: {
        Origin: "https://dashboard.rslcollective.org",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`
      }
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    expect(calls.logoutSessionId).toBeNull();
    expect(calls.deletedSessionId).toBe("ses_logout");
  });

  it("uses the stored WorkOS session ID when building the logout URL", async () => {
    const token = "logout-token";
    const tokenHash = await hashSessionToken(token);
    const logoutUrl =
      "https://api.workos.com/user_management/sessions/logout?session_id=workos_session_test&return_to=https%3A%2F%2Fdashboard.rslcollective.org%2Flogin";
    const { routes, calls } = createHarness({
      session: createSessionRow({
        token_hash: tokenHash,
        workos_session_id: "workos_session_test"
      }),
      logoutUrl
    });
    const response = await logoutRequest(routes, {
      headers: {
        Origin: "https://dashboard.rslcollective.org",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`
      }
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(logoutUrl);
    expect(calls.logoutSessionId).toBe("workos_session_test");
    expect(calls.deletedSessionId).toBe("ses_logout");
  });

  it("falls back to /login when WorkOS logout URL is unavailable", async () => {
    const { routes } = createHarness({ logoutUrl: null });
    const response = await logoutRequest(routes, {
      env: { ENVIRONMENT: "development", DB: {} as D1Database },
      headers: { Origin: "http://localhost:8787" }
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  it("does not implement GET /logout", async () => {
    const { routes } = createHarness();
    const response = await routes.fetch(
      new Request("https://dashboard.rslcollective.org/logout", {
        method: "GET"
      }),
      productionEnv
    );

    expect(response.status).toBe(404);
  });
});
