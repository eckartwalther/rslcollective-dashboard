import { createCompanyRoutes, type CompanyRouteDeps } from "../worker/routes/company";
import type { ClerkAuthDeps } from "../worker/lib/clerk";
import type { CompanyData, CompanyRow, UserRow } from "../worker/lib/db";

const validPayload = {
  legalName: "Example Media Inc.",
  displayName: "Example Media",
  companyType: "Publisher",
  primaryContactName: "Jane Publisher",
  primaryContactEmail: "jane@example.com",
  billingContactEmail: "",
  country: "us",
  region: "",
  city: "Los Angeles",
  postalCode: "90001",
  addressLine1: "123 Main Street",
  addressLine2: "",
  description: ""
};

const productionEnv = {
  CLERK_AUTHORIZED_PARTIES: "https://dashboard.rslcollective.org",
  CLERK_SECRET_KEY: "sk_test_mock",
  ENVIRONMENT: "production",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  DB: {} as D1Database
};

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_test",
    auth_provider: "clerk",
    auth_subject: "user_clerk_test",
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

function companyRowFromData(data: CompanyData, overrides: Partial<CompanyRow> = {}): CompanyRow {
  return {
    id: "cmp_test",
    legal_name: data.legalName,
    display_name: data.displayName ?? null,
    company_type: data.companyType ?? null,
    primary_contact_name: data.primaryContactName,
    primary_contact_email: data.primaryContactEmail,
    billing_contact_email: data.billingContactEmail ?? null,
    country: data.country,
    region: data.region ?? null,
    city: data.city ?? null,
    postal_code: data.postalCode ?? null,
    address_line1: data.addressLine1 ?? null,
    address_line2: data.addressLine2 ?? null,
    description: data.description ?? null,
    status: "draft",
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides
  };
}

function createHarness(options: { authenticated?: boolean; user?: UserRow; company?: CompanyRow } = {}) {
  let user = options.user ?? createUser();
  let company = options.company ?? null;
  const calls = {
    created: 0,
    updated: 0,
    createdWithUserId: null as string | null
  };
  const clerkAuth: ClerkAuthDeps = {
    verifyToken: vi.fn(async () => ({ sub: "user_clerk_test" })) as unknown as ClerkAuthDeps["verifyToken"],
    getClerkUser: vi.fn(async () => ({
      id: "user_clerk_test",
      firstName: "Jane",
      lastName: "Publisher",
      primaryEmailAddressId: "idn_email",
      emailAddresses: [
        {
          id: "idn_email",
          emailAddress: "publisher@example.com",
          verification: { status: "verified" }
        }
      ]
    })),
    getUserByAuthIdentity: vi.fn(async () => (options.authenticated === false ? null : user)),
    createUserFromAuthIdentity: vi.fn(async () => user),
    updateUserFromAuthIdentity: vi.fn(async () => user)
  };

  const deps: CompanyRouteDeps = {
    clerkAuth,
    getCompanyForUser: async () => (user.company_id ? company : null),
    createCompanyAndAttachUser: async (_db, userId, data) => {
      calls.created += 1;
      calls.createdWithUserId = userId;
      company = companyRowFromData(data, { id: "cmp_created" });
      user = { ...user, company_id: company.id };
      return company;
    },
    updateCompanyForUser: async (_db, _userId, data) => {
      calls.updated += 1;
      company = companyRowFromData(data, {
        id: user.company_id ?? "cmp_existing",
        created_at: company?.created_at ?? "2026-06-11T00:00:00.000Z",
        updated_at: "2026-06-12T00:00:00.000Z"
      });
      return company;
    }
  };

  return {
    calls,
    clerkAuth,
    route: createCompanyRoutes(deps),
    setUser: (nextUser: UserRow) => {
      user = nextUser;
    }
  };
}

function authHeaders(extra: HeadersInit = {}) {
  return {
    Authorization: "Bearer clerk-session-token",
    ...extra
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("company API", () => {
  it("returns 401 for unauthenticated GET", async () => {
    const { route } = createHarness({ authenticated: false });
    const response = await route.request("/", {}, productionEnv);

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({
      error: {
        code: "unauthenticated",
        message: "Authentication required."
      }
    });
  });

  it("returns company null for an authenticated user with no company", async () => {
    const { route } = createHarness();
    const response = await route.request("/", { headers: authHeaders() }, productionEnv);

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ company: null });
  });

  it("returns a full company object for an authenticated user with a company", async () => {
    const company = companyRowFromData(
      {
        legalName: "Example Media Inc.",
        displayName: "Example Media",
        companyType: "Publisher",
        primaryContactName: "Jane Publisher",
        primaryContactEmail: "jane@example.com",
        billingContactEmail: null,
        country: "US",
        region: "CA",
        city: "Los Angeles",
        postalCode: "90001",
        addressLine1: "123 Main Street",
        addressLine2: null,
        description: "Example publisher profile."
      },
      { id: "cmp_existing" }
    );
    const { route } = createHarness({
      user: createUser({ company_id: "cmp_existing" }),
      company
    });
    const response = await route.request("/", { headers: authHeaders() }, productionEnv);

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      company: {
        legalName: "Example Media Inc.",
        displayName: "Example Media",
        companyType: "Publisher",
        primaryContactName: "Jane Publisher",
        primaryContactEmail: "jane@example.com",
        billingContactEmail: null,
        country: "US",
        region: "CA",
        city: "Los Angeles",
        postalCode: "90001",
        addressLine1: "123 Main Street",
        addressLine2: null,
        description: "Example publisher profile.",
        status: "draft",
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z"
      }
    });
  });

  it("returns 401 for unauthenticated PUT", async () => {
    const { route } = createHarness({ authenticated: false });
    const response = await route.request(
      "/",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://dashboard.rslcollective.org"
        },
        body: JSON.stringify(validPayload)
      },
      productionEnv
    );

    expect(response.status).toBe(401);
  });

  it("rejects missing or invalid production Origin for authenticated PUT", async () => {
    const { route } = createHarness();
    const missing = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(validPayload)
      },
      productionEnv
    );
    const invalid = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
          Origin: "https://example.com"
        }),
        body: JSON.stringify(validPayload)
      },
      productionEnv
    );

    expect(missing.status).toBe(403);
    expect(invalid.status).toBe(403);
  });

  it("creates the first company and attaches the user", async () => {
    const { route, calls } = createHarness();
    const response = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
          Origin: "https://dashboard.rslcollective.org"
        }),
        body: JSON.stringify(validPayload)
      },
      productionEnv
    );
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(calls.created).toBe(1);
    expect(calls.createdWithUserId).toBe("usr_test");
    expect(calls.updated).toBe(0);
    expect(body.company).toMatchObject({
      legalName: "Example Media Inc.",
      companyType: "Publisher",
      billingContactEmail: null,
      country: "US"
    });
  });

  it("updates an existing company", async () => {
    const { route, calls } = createHarness({
      user: createUser({ company_id: "cmp_existing" }),
      company: companyRowFromData(validPayload, { id: "cmp_existing" })
    });
    const response = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
          Origin: "https://dashboard.rslcollective.org"
        }),
        body: JSON.stringify({ ...validPayload, displayName: "Updated Media" })
      },
      productionEnv
    );

    expect(response.status).toBe(200);
    expect(calls.created).toBe(0);
    expect(calls.updated).toBe(1);
    expect(await readJson(response)).toMatchObject({
      company: {
        displayName: "Updated Media",
        updatedAt: "2026-06-12T00:00:00.000Z"
      }
    });
  });

  it("returns validation errors without saving invalid payloads", async () => {
    const { route, calls } = createHarness();
    const response = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
          Origin: "https://dashboard.rslcollective.org"
        }),
        body: JSON.stringify({ ...validPayload, primaryContactEmail: "bad-email" })
      },
      productionEnv
    );

    expect(response.status).toBe(400);
    expect(calls.created).toBe(0);
    expect(await readJson(response)).toMatchObject({
      error: {
        code: "validation_error",
        fields: {
          primaryContactEmail: "Invalid email address"
        }
      }
    });
  });

  it("does not sync Clerk profile fields on company requests when the local user exists", async () => {
    const { clerkAuth, route } = createHarness();
    const response = await route.request("/", { headers: authHeaders() }, productionEnv);

    expect(response.status).toBe(200);
    expect(clerkAuth.getClerkUser).not.toHaveBeenCalled();
    expect(clerkAuth.updateUserFromAuthIdentity).not.toHaveBeenCalled();
  });
});
