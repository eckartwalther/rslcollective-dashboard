import { createAdminRoutes, type AdminRouteDeps } from "../worker/routes/admin";
import type { ClerkAuthDeps } from "../worker/lib/clerk";
import type { AdminUserDetailRow, AdminUserListRow, UserRow } from "../worker/lib/db";

const env = {
  ADMIN_EMAILS: "eckart@rslcollective.org",
  CLERK_AUTHORIZED_PARTIES: "https://dashboard.rslcollective.org",
  CLERK_SECRET_KEY: "sk_test_mock",
  ENVIRONMENT: "production",
  DB: {} as D1Database
};

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_admin",
    auth_provider: "clerk",
    auth_subject: "user_clerk_admin",
    company_id: null,
    email: "eckart@rslcollective.org",
    first_name: "Eckart",
    last_name: "Admin",
    email_verified: 1,
    role: "owner",
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides
  };
}

function createListRow(overrides: Partial<AdminUserListRow> = {}): AdminUserListRow {
  return {
    id: "usr_1",
    email: "newest@example.com",
    first_name: "Newest",
    last_name: "User",
    auth_provider: "clerk",
    created_at: "2026-06-12T00:00:00.000Z",
    updated_at: "2026-06-12T00:00:00.000Z",
    company_id: "cmp_1",
    company_legal_name: "Newest Media LLC",
    ...overrides
  };
}

function createDetailRow(overrides: Partial<AdminUserDetailRow> = {}): AdminUserDetailRow {
  return {
    ...createListRow(),
    email_verified: 1,
    role: "owner",
    company_display_name: "Newest Media",
    company_type: "Publisher",
    company_primary_contact_name: "Newest User",
    company_primary_contact_email: "newest@example.com",
    company_billing_contact_email: null,
    company_country: "US",
    company_region: "CA",
    company_city: "Los Angeles",
    company_postal_code: "90001",
    company_address_line1: "1 Test Way",
    company_address_line2: null,
    company_description: null,
    company_status: "draft",
    company_created_at: "2026-06-12T00:00:00.000Z",
    company_updated_at: "2026-06-12T00:00:00.000Z",
    ...overrides
  };
}

function d1Result<T>(results: T[]) {
  return {
    results,
    success: true,
    meta: {}
  } as D1Result<T>;
}

function createHarness(options: { user?: UserRow | null } = {}) {
  const user = options.user ?? createUser();
  const clerkAuth: ClerkAuthDeps = {
    verifyToken: vi.fn(async () => ({ sub: user?.auth_subject ?? "user_clerk_test" })) as unknown as ClerkAuthDeps["verifyToken"],
    getClerkUser: vi.fn(),
    getUserByAuthIdentity: vi.fn(async () => user),
    createUserFromAuthIdentity: vi.fn()
  };
  const deps: AdminRouteDeps = {
    clerkAuth,
    countUsers: vi.fn(async () => 2),
    listUsers: vi.fn(async () =>
      d1Result([
        createListRow(),
        createListRow({
          id: "usr_2",
          email: "older@example.com",
          first_name: "Older",
          created_at: "2026-06-11T00:00:00.000Z",
          updated_at: "2026-06-11T00:00:00.000Z",
          company_id: null,
          company_legal_name: null
        })
      ])
    ),
    getUserDetail: vi.fn(async () => createDetailRow())
  };

  return {
    deps,
    route: createAdminRoutes(deps)
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("admin API", () => {
  it("returns 401 for unauthenticated users list requests", async () => {
    const { route } = createHarness();
    const response = await route.request("/users", {}, env);

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({
      error: {
        code: "unauthenticated"
      }
    });
  });

  it("returns 403 for authenticated non-admin users list requests", async () => {
    const { route } = createHarness({
      user: createUser({
        email: "jane@example.com"
      })
    });
    const response = await route.request(
      "/users",
      { headers: { Authorization: "Bearer clerk-session-token" } },
      env
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({
      error: {
        code: "forbidden"
      }
    });
  });

  it("returns paginated users newest first for admin users", async () => {
    const { route } = createHarness();
    const response = await route.request(
      "/users?page=1&pageSize=25",
      { headers: { Authorization: "Bearer admin-token" } },
      env
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      page: 1,
      pageSize: 25,
      total: 2,
      totalPages: 1,
      users: [
        {
          id: "usr_1",
          email: "newest@example.com",
          companyLegalName: "Newest Media LLC"
        },
        {
          id: "usr_2",
          email: "older@example.com",
          companyLegalName: null
        }
      ]
    });
    expect(JSON.stringify(body)).not.toContain("admin-token");
    expect(JSON.stringify(body)).not.toContain("auth_subject");
  });

  it("normalizes invalid pagination and clamps page size", async () => {
    const { deps, route } = createHarness();
    const response = await route.request(
      "/users?page=0&pageSize=250",
      { headers: { Authorization: "Bearer admin-token" } },
      env
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      page: 1,
      pageSize: 100
    });
    expect(deps.listUsers).toHaveBeenCalledWith(env.DB, 100, 0);
  });

  it("returns 401 for unauthenticated detail requests", async () => {
    const { route } = createHarness();
    const response = await route.request("/users/usr_1", {}, env);

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin detail requests", async () => {
    const { route } = createHarness({
      user: createUser({
        email: "jane@example.com"
      })
    });
    const response = await route.request(
      "/users/usr_1",
      { headers: { Authorization: "Bearer clerk-session-token" } },
      env
    );

    expect(response.status).toBe(403);
  });

  it("returns a safe user detail for admin users", async () => {
    const { route } = createHarness();
    const response = await route.request(
      "/users/usr_1",
      { headers: { Authorization: "Bearer admin-token" } },
      env
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      user: {
        id: "usr_1",
        email: "newest@example.com",
        authProvider: "clerk",
        company: {
          id: "cmp_1",
          legalName: "Newest Media LLC"
        }
      }
    });
    expect(JSON.stringify(body)).not.toContain("admin-token");
    expect(JSON.stringify(body)).not.toContain("auth_subject");
  });

  it("returns 404 for a missing user detail", async () => {
    const { deps, route } = createHarness();
    vi.mocked(deps.getUserDetail).mockResolvedValueOnce(null);
    const response = await route.request(
      "/users/usr_missing",
      { headers: { Authorization: "Bearer admin-token" } },
      env
    );

    expect(response.status).toBe(404);
    expect(await readJson(response)).toMatchObject({
      error: {
        code: "not_found",
        message: "User not found."
      }
    });
  });
});
