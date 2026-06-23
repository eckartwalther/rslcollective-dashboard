import { createSessionRoutes, type SessionRouteDeps } from "../worker/routes/session";
import {
  DEVELOPMENT_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  hashSessionToken,
  type SessionStore
} from "../worker/lib/session";
import type { SessionData, SessionRow, UserRow } from "../worker/lib/db";

const env = {
  ENVIRONMENT: "production",
  DB: {} as D1Database
};

const developmentEnv = {
  ENVIRONMENT: "development",
  DB: {} as D1Database
};

function createSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "ses_test",
    user_id: "usr_test",
    token_hash: "hash_test",
    csrf_token_hash: null,
    expires_at: "2026-07-11T00:00:00.000Z",
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides
  };
}

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_test",
    auth_provider: "auth0",
    auth_subject: "auth0|user_test",
    company_id: "cmp_test",
    email: "jane@example.com",
    first_name: "Jane",
    last_name: "Publisher",
    email_verified: 1,
    role: "owner",
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides
  };
}

function createHarness(options: { session?: SessionRow | null; user?: UserRow | null } = {}) {
  let session = options.session ?? null;
  const sessionStore: SessionStore = {
    createSession: async (_session: SessionData) => null,
    getSessionByTokenHash: async (tokenHash) =>
      session?.token_hash === tokenHash ? session : null,
    deleteSession: async () => undefined,
    refreshSessionExpiry: async (_sessionId, expiresAt) => {
      session = session ? { ...session, expires_at: expiresAt } : null;
      return session;
    }
  };
  const deps: SessionRouteDeps = {
    createSessionStore: () => sessionStore,
    getUserById: async () => options.user ?? null
  };

  return createSessionRoutes(deps);
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/session", () => {
  it("returns unauthenticated without a valid session cookie", async () => {
    const route = createHarness();
    const response = await route.request("/", {}, env);

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: false });
  });

  it("returns authenticated user shape for a valid session", async () => {
    const token = "valid-session-token";
    const tokenHash = await hashSessionToken(token);
    const route = createHarness({
      session: createSessionRow({ token_hash: tokenHash }),
      user: createUser()
    });
    const response = await route.request(
      "/",
      { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } },
      env
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      authenticated: true,
      user: {
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Publisher",
        role: "owner",
        hasCompany: true
      }
    });
  });

  it("returns authenticated user shape for a valid development session cookie", async () => {
    const token = "valid-development-session-token";
    const tokenHash = await hashSessionToken(token);
    const route = createHarness({
      session: createSessionRow({ token_hash: tokenHash }),
      user: createUser()
    });
    const response = await route.request(
      "/",
      { headers: { Cookie: `${DEVELOPMENT_SESSION_COOKIE_NAME}=${token}` } },
      developmentEnv
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      authenticated: true,
      user: {
        email: "jane@example.com"
      }
    });
  });

  it("does not authenticate a development cookie in production", async () => {
    const token = "dev-cookie-only-token";
    const tokenHash = await hashSessionToken(token);
    const route = createHarness({
      session: createSessionRow({ token_hash: tokenHash }),
      user: createUser()
    });
    const response = await route.request(
      "/",
      { headers: { Cookie: `${DEVELOPMENT_SESSION_COOKIE_NAME}=${token}` } },
      env
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: false });
  });

  it("does not authenticate expired sessions", async () => {
    const token = "expired-session-token";
    const tokenHash = await hashSessionToken(token);
    const route = createHarness({
      session: createSessionRow({
        token_hash: tokenHash,
        expires_at: "2000-01-01T00:00:00.000Z"
      }),
      user: createUser()
    });
    const response = await route.request(
      "/",
      { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } },
      env
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: false });
  });

  it("does not expose provider IDs, session IDs, or token hashes", async () => {
    const token = "safe-response-token";
    const tokenHash = await hashSessionToken(token);
    const route = createHarness({
      session: createSessionRow({ token_hash: tokenHash }),
      user: createUser()
    });
    const response = await route.request(
      "/",
      { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } },
      env
    );
    const body = JSON.stringify(await readJson(response));

    expect(body).not.toContain("auth0|");
    expect(body).not.toContain("auth_subject");
    expect(body).not.toContain("auth_provider");
    expect(body).not.toContain("ses_test");
    expect(body).not.toContain(tokenHash);
    expect(body).not.toContain("token_hash");
  });
});
