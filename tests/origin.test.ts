import { createCompanyRoutes, type CompanyRouteDeps } from "../worker/routes/company";
import { authRoutes } from "../worker/routes/auth";
import { validateOrigin } from "../worker/lib/csrf";
import { SESSION_COOKIE_NAME, type SessionStore } from "../worker/lib/session";
import type { CompanyData, CompanyRow, SessionData, SessionRow, UserRow } from "../worker/lib/db";

const productionEnv = {
  ENVIRONMENT: "production",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  WORKOS_CLIENT_ID: "client_test",
  DB: {} as D1Database
};

const validPayload = {
  legalName: "Example Media Inc.",
  displayName: "Example Media",
  companyType: "Publisher",
  primaryContactName: "Jane Publisher",
  primaryContactEmail: "jane@example.com",
  country: "us",
  region: "",
  city: "Los Angeles",
  postalCode: "90001",
  addressLine1: "123 Main Street",
  addressLine2: "",
  description: ""
};

describe("Origin validation", () => {
  it("rejects missing production Origin", () => {
    const request = new Request("https://dashboard.rslcollective.org/logout", {
      method: "POST"
    });

    expect(validateOrigin(request, productionEnv)).toMatchObject({
      valid: false,
      reason: "missing_origin"
    });
  });

  it("rejects mismatched production Origin", () => {
    const request = new Request("https://dashboard.rslcollective.org/logout", {
      method: "POST",
      headers: { Origin: "https://example.com" }
    });

    expect(validateOrigin(request, productionEnv)).toMatchObject({
      valid: false,
      reason: "mismatched_origin"
    });
  });

  it("accepts matching production Origin", () => {
    const request = new Request("https://dashboard.rslcollective.org/logout", {
      method: "POST",
      headers: { Origin: "https://dashboard.rslcollective.org" }
    });

    expect(validateOrigin(request, productionEnv)).toMatchObject({ valid: true });
  });

  it.each([
    "http://localhost:8787",
    "https://localhost:8787",
    "http://127.0.0.1:8787",
    "https://127.0.0.1:8787",
    "http://[::1]:8787",
    "https://[::1]:8787",
    "http://localhost:8788",
    "https://localhost:8788",
    "http://127.0.0.1:8788",
    "https://127.0.0.1:8788",
    "http://[::1]:8788",
    "https://[::1]:8788"
  ])("accepts local Worker Origin %s in development", (origin) => {
    const request = new Request(`${origin}/logout`, {
      method: "POST",
      headers: { Origin: origin }
    });

    expect(validateOrigin(request, { ENVIRONMENT: "development" })).toMatchObject({
      valid: true,
      productionMode: false,
      normalizedRequestOrigin: origin
    });
  });

  it("treats missing ENVIRONMENT as development", () => {
    const request = new Request("http://localhost:8787/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:8787" }
    });

    expect(validateOrigin(request, {})).toMatchObject({
      valid: true,
      productionMode: false,
      environment: undefined
    });
  });

  it("treats ENVIRONMENT=development as development", () => {
    const request = new Request("http://localhost:8787/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:8787" }
    });

    expect(validateOrigin(request, { ENVIRONMENT: "development" })).toMatchObject({
      valid: true,
      productionMode: false,
      environment: "development"
    });
  });

  it("treats ENVIRONMENT=production as production", () => {
    const request = new Request("http://localhost:8787/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:8787" }
    });

    expect(validateOrigin(request, { ENVIRONMENT: "production" })).toMatchObject({
      valid: false,
      productionMode: true,
      reason: "mismatched_origin",
      environment: "production"
    });
  });

  it("accepts localhost in production only when DASHBOARD_BASE_URL exactly matches after normalization", () => {
    const request = new Request("http://localhost:8787/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:8787/" }
    });

    expect(
      validateOrigin(request, {
        ENVIRONMENT: "production",
        DASHBOARD_BASE_URL: "http://localhost:8787/"
      })
    ).toMatchObject({
      valid: true,
      productionMode: true,
      normalizedRequestOrigin: "http://localhost:8787",
      normalizedDashboardOrigin: "http://localhost:8787"
    });
  });

  it("accepts configured DASHBOARD_BASE_URL Origin in development", () => {
    const request = new Request("https://dashboard-dev.example/logout", {
      method: "POST",
      headers: { Origin: "https://dashboard-dev.example" }
    });

    expect(
      validateOrigin(request, {
        ENVIRONMENT: "development",
        DASHBOARD_BASE_URL: "https://dashboard-dev.example"
      })
    ).toMatchObject({ valid: true });
  });

  it("rejects non-localhost public Origins in development", () => {
    const request = new Request("http://localhost:8787/logout", {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    });

    expect(validateOrigin(request, { ENVIRONMENT: "development" })).toMatchObject({
      valid: false,
      reason: "mismatched_origin"
    });
  });

  it("enforces Origin on POST /logout", async () => {
    const missingOrigin = await authRoutes.request(
      "https://dashboard.rslcollective.org/logout",
      { method: "POST" },
      productionEnv
    );
    const matchingOrigin = await authRoutes.request(
      "https://dashboard.rslcollective.org/logout",
      {
        method: "POST",
        headers: { Origin: "https://dashboard.rslcollective.org" }
      },
      productionEnv
    );

    expect(missingOrigin.status).toBe(403);
    expect(matchingOrigin.status).toBe(302);
    expect(matchingOrigin.headers.get("Set-Cookie")).toContain("__Host-rsl_dashboard_session=");
  });

  it("rejects invalid development Origin on POST /logout", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await authRoutes.request(
      "http://localhost:8787/logout",
      {
        method: "POST",
        headers: { Origin: "https://evil.example" }
      },
      {
        ENVIRONMENT: "development",
        DB: {} as D1Database
      }
    );

    expect(response.status).toBe(403);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"origin_rejected"')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"origin":"https://evil.example"')
    );
    warnSpy.mockRestore();
  });

  it("logs a reduced safe Origin rejection diagnostic in development", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await authRoutes.request(
      "http://localhost:8787/logout",
      {
        method: "POST",
        headers: {
          Host: "localhost:8787",
          Origin: "http://dashboard.rslcollective.org",
          Referer: "http://localhost:8787/dashboard/company"
        }
      },
      {
        ENVIRONMENT: "development",
        DASHBOARD_BASE_URL: "http://localhost:8787",
        DB: {} as D1Database
      }
    );

    expect(response.status).toBe(403);

    const [logLine] = warnSpy.mock.calls.at(-1) as [string];
    const log = JSON.parse(logLine) as Record<string, unknown>;

    expect(log).toMatchObject({
      event: "origin_rejected",
      method: "POST",
      path: "/logout",
      origin: "http://dashboard.rslcollective.org",
      dashboardBaseUrl: "http://localhost:8787",
      environment: "development",
      reason: "mismatched_origin"
    });
    expect(log).not.toHaveProperty("url");
    expect(log).not.toHaveProperty("host");
    expect(log).not.toHaveProperty("referer");
    expect(log).not.toHaveProperty("productionMode");
    expect(log).not.toHaveProperty("normalizedOrigin");
    expect(log).not.toHaveProperty("normalizedDashboardBaseUrl");
    expect(log).not.toHaveProperty("cookie");
    expect(log).not.toHaveProperty("authorization");
    warnSpy.mockRestore();
  });

  it("returns unauthenticated for PUT /api/company when no valid session is present", async () => {
    const companyRoutes = createCompanyRoutes();
    const missingOrigin = await companyRoutes.request(
      "https://dashboard.rslcollective.org/",
      { method: "PUT" },
      productionEnv
    );
    const matchingOrigin = await companyRoutes.request(
      "https://dashboard.rslcollective.org/",
      {
        method: "PUT",
        headers: { Origin: "https://dashboard.rslcollective.org" }
      },
      productionEnv
    );
    const localhostOrigin = await companyRoutes.request(
      "http://localhost:8787/",
      {
        method: "PUT",
        headers: { Origin: "http://localhost:8787" }
      },
      {
        ENVIRONMENT: "development"
      }
    );

    expect(missingOrigin.status).toBe(401);
    expect(matchingOrigin.status).toBe(401);
    expect(localhostOrigin.status).toBe(401);
  });

  it("allows authenticated PUT /api/company save with a valid local development Origin", async () => {
    const { route, calls } = createAuthenticatedCompanyRoute();
    const response = await route.request(
      "https://localhost:8787/",
      {
        method: "PUT",
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=test-token`,
          "Content-Type": "application/json",
          Origin: "https://localhost:8787"
        },
        body: JSON.stringify(validPayload)
      },
      {
        ENVIRONMENT: "development",
        DB: {} as D1Database
      }
    );

    expect(response.status).toBe(201);
    expect(calls.created).toBe(1);
  });

  it("allows authenticated PUT /api/company save with http localhost Origin and missing ENVIRONMENT", async () => {
    const { route, calls } = createAuthenticatedCompanyRoute();
    const response = await route.request(
      "http://localhost:8787/",
      {
        method: "PUT",
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=test-token`,
          "Content-Type": "application/json",
          Origin: "http://localhost:8787"
        },
        body: JSON.stringify(validPayload)
      },
      {
        DB: {} as D1Database
      }
    );

    expect(response.status).not.toBe(403);
    expect(response.status).toBe(201);
    expect(calls.created).toBe(1);
  });

  it("rejects authenticated PUT /api/company save with a public development Origin", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { route, calls } = createAuthenticatedCompanyRoute();
    const response = await route.request(
      "http://localhost:8787/",
      {
        method: "PUT",
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=test-token`,
          "Content-Type": "application/json",
          Origin: "https://evil.example"
        },
        body: JSON.stringify(validPayload)
      },
      {
        ENVIRONMENT: "development",
        DB: {} as D1Database
      }
    );

    expect(response.status).toBe(403);
    expect(calls.created).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"origin_rejected"')
    );
    warnSpy.mockRestore();
  });
});

function createAuthenticatedCompanyRoute() {
  const calls = {
    created: 0
  };
  const sessionStore: SessionStore = {
    createSession: async (_session: SessionData) => null,
    getSessionByTokenHash: async () => createSessionRow(),
    deleteSession: async () => undefined,
    refreshSessionExpiry: async (_sessionId, expiresAt) => createSessionRow({ expires_at: expiresAt })
  };
  const deps: CompanyRouteDeps = {
    createSessionStore: () => sessionStore,
    getUserById: async () => createUser(),
    getCompanyForUser: async () => null,
    createCompanyAndAttachUser: async (_db, _userId, data) => {
      calls.created += 1;
      return companyRowFromData(data);
    },
    updateCompanyForUser: async (_db, _userId, data) => companyRowFromData(data)
  };

  return {
    calls,
    route: createCompanyRoutes(deps)
  };
}

function createUser(): UserRow {
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
    updated_at: "2026-06-11T00:00:00.000Z"
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

function companyRowFromData(data: CompanyData): CompanyRow {
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
    updated_at: "2026-06-11T00:00:00.000Z"
  };
}
