import { companyRoutes } from "../worker/routes/company";
import { authRoutes } from "../worker/routes/auth";
import { validateOrigin } from "../worker/lib/csrf";

const productionEnv = {
  ENVIRONMENT: "production",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  WORKOS_CLIENT_ID: "client_test",
  DB: {} as D1Database
};

describe("Origin validation", () => {
  it("rejects missing production Origin", () => {
    const request = new Request("https://dashboard.rslcollective.org/logout", {
      method: "POST"
    });

    expect(validateOrigin(request, productionEnv)).toEqual({
      valid: false,
      reason: "missing_origin"
    });
  });

  it("rejects mismatched production Origin", () => {
    const request = new Request("https://dashboard.rslcollective.org/logout", {
      method: "POST",
      headers: { Origin: "https://example.com" }
    });

    expect(validateOrigin(request, productionEnv)).toEqual({
      valid: false,
      reason: "mismatched_origin"
    });
  });

  it("accepts matching production Origin", () => {
    const request = new Request("https://dashboard.rslcollective.org/logout", {
      method: "POST",
      headers: { Origin: "https://dashboard.rslcollective.org" }
    });

    expect(validateOrigin(request, productionEnv)).toEqual({ valid: true });
  });

  it("accepts localhost Origin in development", () => {
    const request = new Request("http://localhost:8787/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:8787" }
    });

    expect(validateOrigin(request, { ENVIRONMENT: "development" })).toEqual({ valid: true });
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

  it("returns unauthenticated for PUT /api/company when no valid session is present", async () => {
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
});
