import { createCompanyRoutes, type CompanyRouteDeps } from "../worker/routes/company";
import { SESSION_COOKIE_NAME, type SessionStore } from "../worker/lib/session";
import type { CompanyData, CompanyRow, SessionData, SessionRow, UserRow } from "../worker/lib/db";

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
  ENVIRONMENT: "production",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  DB: {} as D1Database
};

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_test",
    workos_user_id: "workos_test",
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

  const sessionStore: SessionStore = {
    createSession: async (_session: SessionData) => null,
    getSessionByTokenHash: async () => (options.authenticated === false ? null : createSessionRow()),
    deleteSession: async () => undefined,
    refreshSessionExpiry: async (_sessionId, expiresAt) => createSessionRow({ expires_at: expiresAt })
  };

  const deps: CompanyRouteDeps = {
    createSessionStore: () => sessionStore,
    getUserById: async () => user,
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
    route: createCompanyRoutes(deps),
    setUser: (nextUser: UserRow) => {
      user = nextUser;
    },
    setCompany: (nextCompany: CompanyRow | null) => {
      company = nextCompany;
    }
  };
}

function authHeaders(extra: HeadersInit = {}) {
  return {
    Cookie: `${SESSION_COOKIE_NAME}=test-token`,
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
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await readJson(response)).toEqual({
      error: {
        code: "unauthenticated",
        message: "Authentication required."
      }
    });
  });

  it("returns company null for an authenticated user with no company", async () => {
    const { route } = createHarness();
    const response = await route.request(
      "/",
      { headers: authHeaders() },
      productionEnv
    );

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
    const response = await route.request(
      "/",
      { headers: authHeaders() },
      productionEnv
    );

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

  it("accepts matching production Origin for authenticated PUT", async () => {
    const { route } = createHarness();
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

    expect(response.status).toBe(201);
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
        body: JSON.stringify({
          ...validPayload,
          legalName: "Updated Media Inc."
        })
      },
      productionEnv
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(calls.created).toBe(0);
    expect(calls.updated).toBe(1);
    expect(body.company).toMatchObject({
      legalName: "Updated Media Inc.",
      updatedAt: "2026-06-12T00:00:00.000Z"
    });
  });

  it.each([
    ["company_id", { company_id: "cmp_test" }],
    ["companyId", { companyId: "cmp_test" }],
    ["role", { role: "owner" }],
    ["status", { status: "approved" }],
    ["unsupported companyType", { companyType: "Agency" }],
    ["unsupported company_type", { company_type: "Agency" }]
  ])("rejects client-supplied or unsupported field %s", async (_label, extra) => {
    const { route } = createHarness();
    const response = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
          Origin: "https://dashboard.rslcollective.org"
        }),
        body: JSON.stringify({
          ...validPayload,
          ...extra
        })
      },
      productionEnv
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "validation_error"
      }
    });
  });

  it("returns validation_error for invalid payloads", async () => {
    const { route } = createHarness();
    const response = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
          Origin: "https://dashboard.rslcollective.org"
        }),
        body: JSON.stringify({
          ...validPayload,
          legalName: "A",
          primaryContactEmail: "not-an-email"
        })
      },
      productionEnv
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "validation_error",
        message: "Invalid company profile."
      }
    });
  });

  it.each([
    ["addressLine1"],
    ["city"],
    ["postalCode"]
  ])("rejects PUT payloads missing %s", async (field) => {
    const { route } = createHarness();
    const response = await route.request(
      "/",
      {
        method: "PUT",
        headers: authHeaders({
          "Content-Type": "application/json",
          Origin: "https://dashboard.rslcollective.org"
        }),
        body: JSON.stringify(omitField(validPayload, field))
      },
      productionEnv
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "validation_error",
        message: "Invalid company profile."
      }
    });
  });

  it("includes every editable field in the company response", async () => {
    const { route } = createHarness({
      user: createUser({ company_id: "cmp_existing" }),
      company: companyRowFromData(validPayload, { id: "cmp_existing" })
    });
    const response = await route.request(
      "/",
      { headers: authHeaders() },
      productionEnv
    );
    const body = (await readJson(response)) as { company: Record<string, unknown> };

    expect(Object.keys(body.company).sort()).toEqual(
      [
        "addressLine1",
        "addressLine2",
        "billingContactEmail",
        "city",
        "companyType",
        "country",
        "createdAt",
        "description",
        "displayName",
        "legalName",
        "postalCode",
        "primaryContactEmail",
        "primaryContactName",
        "region",
        "status",
        "updatedAt"
      ].sort()
    );
  });
});

function omitField<T extends Record<string, unknown>>(payload: T, field: string) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== field));
}
