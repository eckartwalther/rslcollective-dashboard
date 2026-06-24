import app from "../worker/index";

const env = {
  ADMIN_EMAILS: "eckart@rslcollective.org",
  CLERK_AUTHORIZED_PARTIES: "https://dashboard.rslcollective.org",
  CLERK_SECRET_KEY: "sk_test_mock",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  ENVIRONMENT: "production",
  DB: {} as D1Database,
  ASSETS: {
    fetch: async () => new Response("spa asset fallback")
  } as unknown as Fetcher
};

const localEnv = {
  ...env,
  CLERK_AUTHORIZED_PARTIES: "http://localhost:8787,http://127.0.0.1:8787",
  DASHBOARD_BASE_URL: "http://localhost:8787",
  ENVIRONMENT: "development"
};

describe("Worker routing", () => {
  it("/auth/callback is no longer an authentication route", async () => {
    const response = await app.fetch(
      new Request("https://dashboard.rslcollective.org/auth/callback?code=test"),
      env
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: {
        code: "not_found"
      }
    });
  });

  it("keeps unknown API routes as JSON 404 responses", async () => {
    const response = await app.fetch(
      new Request("https://dashboard.rslcollective.org/api/does-not-exist"),
      env
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Route not found."
      }
    });
  });

  it.each([
    "/login",
    "/login/sso-callback",
    "/register",
    "/register/verify",
    "/logout",
    "/admin/users",
    "/admin/users/usr_test"
  ])(
    "serves the SPA for Clerk route %s",
    async (path) => {
      const response = await app.fetch(
        new Request(`http://localhost:8787${path}`, {
          headers: { Host: "localhost:8787" }
        }),
        localEnv
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("spa asset fallback");
    }
  );

  it("serves the SPA for root so Clerk can route by auth state", async () => {
    const response = await app.fetch(new Request("http://localhost:8787/"), localEnv);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("spa asset fallback");
  });

  it("keeps /api/company local unauthenticated behavior behind a valid local host", async () => {
    const response = await app.fetch(
      new Request("http://localhost:8787/api/company", {
        method: "PUT",
        headers: {
          Host: "localhost:8787",
          Origin: "http://localhost:8787"
        }
      }),
      localEnv
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      error: {
        code: "unauthenticated"
      }
    });
  });
});
