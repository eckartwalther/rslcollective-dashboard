import { createAuthRoutes, type AuthRouteDeps } from "../worker/routes/auth";
import {
  AUTH_STATE_TTL_MS,
  createSignedAuthState,
  DEVELOPMENT_SESSION_COOKIE_NAME,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  type SessionStore
} from "../worker/lib/session";
import type { SessionData, SessionRow, UserRow, WorkosUserData } from "../worker/lib/db";
import type { WorkosAuthenticatedUser, WorkosAuthEnv } from "../worker/lib/workos";

const env = {
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  WORKOS_API_KEY: "sk_test",
  SESSION_SECRET: "test-session-secret",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  ENVIRONMENT: "production",
  DB: {} as D1Database
};

const localEnv = {
  ...env,
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  DASHBOARD_BASE_URL: "http://localhost:8787",
  ENVIRONMENT: "development"
};

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_local",
    workos_user_id: "user_workos",
    company_id: null,
    email: "publisher@example.com",
    first_name: "Jane",
    last_name: "Publisher",
    email_verified: 1,
    role: "owner",
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides
  };
}

function createSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "ses_local",
    user_id: "usr_local",
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
  existingUser?: UserRow | null;
  rootSession?: SessionRow | null;
  workosUser?: WorkosAuthenticatedUser;
} = {}) {
  let user = options.existingUser ?? null;
  const calls = {
    exchangedCode: null as string | null,
    createdUser: null as WorkosUserData | null,
    updatedUser: null as WorkosUserData | null,
    createdSession: null as SessionData | null
  };
  const rootSession = options.rootSession;

  const sessionStore: SessionStore = {
    createSession: async (session) => {
      calls.createdSession = session;
      return createSessionRow({
        user_id: session.userId,
        token_hash: session.tokenHash,
        csrf_token_hash: session.csrfTokenHash ?? null,
        workos_session_id: session.workosSessionId ?? null,
        expires_at: session.expiresAt
      });
    },
    getSessionByTokenHash: async (tokenHash) =>
      rootSession ? { ...rootSession, token_hash: tokenHash } : null,
    deleteSession: async () => undefined,
    refreshSessionExpiry: async (_sessionId, expiresAt) =>
      rootSession ? { ...rootSession, expires_at: expiresAt } : null
  };

  const deps: AuthRouteDeps = {
    createSessionStore: () => sessionStore,
    exchangeAuthorizationCode: async (_env: WorkosAuthEnv, code: string) => {
      calls.exchangedCode = code;
      return (
        options.workosUser ?? {
          id: "user_workos",
          email: "publisher@example.com",
          firstName: "Jane",
          lastName: "Publisher",
          emailVerified: true,
          sessionId: "workos_session_test"
        }
      );
    },
    getUserByWorkosUserId: async () => user,
    createUserFromWorkos: async (_db, workosUser) => {
      calls.createdUser = workosUser;
      user = createUser({
        id: "usr_created",
        workos_user_id: workosUser.workosUserId,
        email: workosUser.email,
        first_name: workosUser.firstName ?? null,
        last_name: workosUser.lastName ?? null,
        email_verified: workosUser.emailVerified ? 1 : 0
      });
      return user;
    },
    updateUserFromWorkos: async (_db, workosUser) => {
      calls.updatedUser = workosUser;
      user = createUser({
        ...(user ?? {}),
        id: user?.id ?? "usr_existing",
        workos_user_id: workosUser.workosUserId,
        email: workosUser.email,
        first_name: workosUser.firstName ?? null,
        last_name: workosUser.lastName ?? null,
        email_verified: workosUser.emailVerified ? 1 : 0
      });
      return user;
    },
    getLogoutUrl: () => "/login"
  };

  return {
    calls,
    routes: createAuthRoutes(deps)
  };
}

async function signedState(options: Parameters<typeof createSignedAuthState>[0] = {
  flow: "login",
  secret: env.SESSION_SECRET
}) {
  return createSignedAuthState(options);
}

function callbackUrl(params: URLSearchParams) {
  return `https://dashboard.rslcollective.org/auth/callback?${params.toString()}`;
}

function localCallbackUrl(params: URLSearchParams) {
  return `http://localhost:8787/auth/callback?${params.toString()}`;
}

async function callbackRequest(
  routes: ReturnType<typeof createAuthRoutes>,
  params: URLSearchParams,
  requestEnv = env
) {
  return routes.fetch(new Request(callbackUrl(params)), requestEnv);
}

async function localCallbackRequest(
  routes: ReturnType<typeof createAuthRoutes>,
  params: URLSearchParams,
  requestEnv = localEnv
) {
  return routes.fetch(new Request(localCallbackUrl(params)), requestEnv);
}

async function expectAuthErrorPage(
  response: Response,
  expectedTitle: string,
  forbiddenValues: string[] = []
) {
  const body = await response.text();

  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.headers.get("Content-Type")).toContain("text/html");
  expect(body).toContain(expectedTitle);
  expect(body).toContain("Sign in again");
  expect(body).toContain('href="/login"');
  expect(body).toContain("Create an account");
  expect(body).toContain('href="/register"');
  expect(body).not.toContain("validation_error");
  expect(body).not.toContain('"error"');
  expect(body).not.toContain('"fields"');

  for (const value of forbiddenValues) {
    expect(body).not.toContain(value);
  }
}

describe("AuthKit callback", () => {
  it("rejects missing state", async () => {
    const { routes } = createHarness();
    const response = await callbackRequest(routes, new URLSearchParams({ code: "code_test" }));

    await expectAuthErrorPage(response, "Sign-in link expired", ["code_test"]);
  });

  it("rejects malformed state", async () => {
    const { routes } = createHarness();
    const response = await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_test", state: "malformed" })
    );

    await expectAuthErrorPage(response, "Sign-in link expired", ["code_test", "malformed"]);
  });

  it("rejects tampered state", async () => {
    const { routes } = createHarness();
    const state = `${await signedState()}tampered`;
    const response = await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_test", state })
    );

    await expectAuthErrorPage(response, "Sign-in link expired", ["code_test", state]);
  });

  it("rejects expired state", async () => {
    const { routes } = createHarness();
    const state = await signedState({
      flow: "login",
      secret: env.SESSION_SECRET,
      now: new Date(Date.now() - AUTH_STATE_TTL_MS - 1000)
    });
    const response = await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_test", state })
    );

    await expectAuthErrorPage(response, "Sign-in link expired", ["code_test", state]);
  });

  it("rejects unsupported flow", async () => {
    const { routes } = createHarness();
    const state = await signedState({
      flow: "unsupported" as never,
      secret: env.SESSION_SECRET
    });
    const response = await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_test", state })
    );

    await expectAuthErrorPage(response, "Sign-in link expired", ["code_test", state]);
  });

  it("rejects missing authorization code", async () => {
    const { routes } = createHarness();
    const state = await signedState();
    const response = await callbackRequest(
      routes,
      new URLSearchParams({ state })
    );

    await expectAuthErrorPage(response, "Authentication could not be completed", [state]);
  });

  it("exchanges a valid code through the WorkOS helper", async () => {
    const { routes, calls } = createHarness();
    const response = await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_valid", state: await signedState() })
    );

    expect(response.status).toBe(302);
    expect(calls.exchangedCode).toBe("code_valid");
  });

  it("creates a new local user when none exists", async () => {
    const { routes, calls } = createHarness({ existingUser: null });
    await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_valid", state: await signedState() })
    );

    expect(calls.createdUser).toEqual({
      workosUserId: "user_workos",
      email: "publisher@example.com",
      firstName: "Jane",
      lastName: "Publisher",
      emailVerified: true
    });
    expect(calls.updatedUser).toBeNull();
  });

  it("updates an existing local user", async () => {
    const { routes, calls } = createHarness({
      existingUser: createUser({ id: "usr_existing" }),
      workosUser: {
        id: "user_workos",
        email: "updated@example.com",
        firstName: "Updated",
        lastName: "Publisher",
        emailVerified: false,
        sessionId: "workos_session_updated"
      }
    });
    await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_valid", state: await signedState() })
    );

    expect(calls.createdUser).toBeNull();
    expect(calls.updatedUser).toEqual({
      workosUserId: "user_workos",
      email: "updated@example.com",
      firstName: "Updated",
      lastName: "Publisher",
      emailVerified: false
    });
  });

  it("creates a local D1-backed session without storing the raw token", async () => {
    const { routes, calls } = createHarness();
    await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_valid", state: await signedState() })
    );

    expect(calls.createdSession).toMatchObject({
      userId: "usr_created",
      workosSessionId: "workos_session_test",
      expiresAt: expect.any(String)
    });
    expect(calls.createdSession?.tokenHash).toEqual(expect.any(String));
    expect(calls.createdSession).not.toHaveProperty("token");
  });

  it("sets the __Host-rsl_dashboard_session cookie and redirects to /dashboard", async () => {
    const { routes } = createHarness();
    const response = await callbackRequest(
      routes,
      new URLSearchParams({ code: "code_valid", state: await signedState() })
    );
    const cookie = response.headers.get("Set-Cookie");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard");
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
  });

  it("redirects local callback success to relative /dashboard", async () => {
    const { routes } = createHarness();
    const response = await localCallbackRequest(
      routes,
      new URLSearchParams({
        code: "code_valid",
        state: await signedState({
          flow: "login",
          secret: localEnv.SESSION_SECRET
        })
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("sets the development session cookie on local callback success", async () => {
    const { routes, calls } = createHarness();
    const response = await localCallbackRequest(
      routes,
      new URLSearchParams({
        code: "code_valid",
        state: await signedState({
          flow: "login",
          secret: localEnv.SESSION_SECRET
        })
      })
    );
    const cookie = response.headers.get("Set-Cookie");

    expect(response.status).toBe(302);
    expect(calls.createdSession).toMatchObject({
      userId: "usr_created",
      workosSessionId: "workos_session_test",
      expiresAt: expect.any(String)
    });
    expect(calls.createdSession).not.toHaveProperty("token");
    expect(cookie).toContain(`${DEVELOPMENT_SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure");
    expect(cookie).not.toContain("Domain=");
    expect(cookie).not.toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("redirects local callback success to a relative returnTo path", async () => {
    const { routes } = createHarness();
    const response = await localCallbackRequest(
      routes,
      new URLSearchParams({
        code: "code_valid",
        state: await signedState({
          flow: "login",
          secret: localEnv.SESSION_SECRET,
          returnTo: "/dashboard/company"
        })
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard/company");
    expect(response.headers.get("Location")).not.toContain("dashboard.rslcollective.org");
  });

  it("redirects root to /login when unauthenticated", async () => {
    const { routes } = createHarness({ rootSession: null });
    const response = await routes.fetch(new Request("https://dashboard.rslcollective.org/"), env);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  it("redirects root to /dashboard when authenticated", async () => {
    const token = "root-token";
    const tokenHash = await hashSessionToken(token);
    const { routes } = createHarness({
      rootSession: createSessionRow({ token_hash: tokenHash })
    });
    const response = await routes.fetch(
      new Request("https://dashboard.rslcollective.org/", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` }
      }),
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard");
  });
});
