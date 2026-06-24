import { createSessionRoutes, type SessionRouteDeps } from "../worker/routes/session";
import type { ClerkAuthDeps, ClerkBackendUser } from "../worker/lib/clerk";
import type { AuthenticatedUserData, UserRow } from "../worker/lib/db";

const env = {
  CLERK_AUTHORIZED_PARTIES: "https://dashboard.rslcollective.org",
  CLERK_SECRET_KEY: "sk_test_mock",
  ENVIRONMENT: "production",
  DB: {} as D1Database
};

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_test",
    auth_provider: "clerk",
    auth_subject: "user_clerk_test",
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

function createClerkUser(overrides: Partial<ClerkBackendUser> = {}): ClerkBackendUser {
  return {
    id: "user_clerk_test",
    firstName: "Jane",
    lastName: "Publisher",
    primaryEmailAddressId: "idn_email",
    emailAddresses: [
      {
        id: "idn_email",
        emailAddress: "jane@example.com",
        verification: { status: "verified" }
      }
    ],
    ...overrides
  };
}

function createHarness(options: { user?: UserRow | null; tokenSub?: string | null } = {}) {
  const user = options.user ?? createUser();
  const calls = {
    createdUser: null as AuthenticatedUserData | null,
    updatedUser: null as AuthenticatedUserData | null
  };
  const clerkAuth: ClerkAuthDeps = {
    verifyToken: vi.fn(async () => ({ sub: options.tokenSub ?? "user_clerk_test" })) as unknown as ClerkAuthDeps["verifyToken"],
    getClerkUser: vi.fn(async () => createClerkUser()),
    getUserByAuthIdentity: vi.fn(async () => options.user ?? null),
    createUserFromAuthIdentity: vi.fn(async (_db, data) => {
      calls.createdUser = data;
      return user;
    }),
    updateUserFromAuthIdentity: vi.fn(async (_db, data) => {
      calls.updatedUser = data;
      return user;
    })
  };
  const deps: SessionRouteDeps = { clerkAuth };

  return {
    calls,
    clerkAuth,
    route: createSessionRoutes(deps)
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GET /api/session", () => {
  it("returns unauthenticated without a Clerk bearer token", async () => {
    const { route } = createHarness();
    const response = await route.request("/", {}, env);

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: false });
  });

  it("provisions a local D1 user from the verified Clerk user", async () => {
    const { calls, route } = createHarness({ user: null });
    const response = await route.request(
      "/",
      { headers: { Authorization: "Bearer clerk-session-token" } },
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
    expect(calls.createdUser).toMatchObject({
      authProvider: "clerk",
      authSubject: "user_clerk_test",
      email: "jane@example.com",
      emailVerified: true
    });
  });

  it("updates an existing local user when /api/session is read", async () => {
    const { calls, route } = createHarness({ user: createUser() });
    const response = await route.request(
      "/",
      { headers: { Authorization: "Bearer clerk-session-token" } },
      env
    );

    expect(response.status).toBe(200);
    expect(calls.createdUser).toBeNull();
    expect(calls.updatedUser).toMatchObject({
      authProvider: "clerk",
      authSubject: "user_clerk_test",
      email: "jane@example.com"
    });
  });

  it("does not expose provider IDs or Clerk token claims", async () => {
    const { route } = createHarness({ user: null });
    const response = await route.request(
      "/",
      { headers: { Authorization: "Bearer safe-response-token" } },
      env
    );
    const body = JSON.stringify(await readJson(response));

    expect(body).not.toContain("user_clerk_test");
    expect(body).not.toContain("auth_subject");
    expect(body).not.toContain("auth_provider");
    expect(body).not.toContain("safe-response-token");
  });

  it("returns unauthenticated when Clerk token verification fails", async () => {
    const { clerkAuth, route } = createHarness();
    vi.mocked(clerkAuth.verifyToken).mockRejectedValueOnce(new Error("bad token"));

    const response = await route.request(
      "/",
      { headers: { Authorization: "Bearer invalid-token" } },
      env
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ authenticated: false });
  });
});
