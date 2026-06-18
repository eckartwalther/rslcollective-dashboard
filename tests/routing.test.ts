import app from "../worker/index";

const env = {
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  WORKOS_API_KEY: "sk_test",
  SESSION_SECRET: "test-session-secret",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  ENVIRONMENT: "production",
  DB: {} as D1Database,
  ASSETS: {
    fetch: async () => new Response("spa asset fallback")
  } as unknown as Fetcher
};

const localEnv = {
  ...env,
  WORKOS_REDIRECT_URI: "http://localhost:8787/auth/callback",
  DASHBOARD_BASE_URL: "http://localhost:8787",
  ENVIRONMENT: "development"
};

describe("Worker routing", () => {
  it("/auth/callback remains Worker-handled instead of SPA-handled", async () => {
    const response = await app.fetch(
      new Request("https://dashboard.rslcollective.org/auth/callback?code=test"),
      env
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "validation_error",
        fields: {
          state: "missing"
        }
      }
    });
  });

  it("accepts localhost host in development when DASHBOARD_BASE_URL is localhost", async () => {
    const response = await app.fetch(
      new Request("http://localhost:8787/login", {
        headers: { Host: "localhost:8787" }
      }),
      localEnv
    );
    const location = response.headers.get("Location");

    expect(response.status).toBe(302);
    expect(location).toContain("https://api.workos.com/user_management/authorize");
    expect(location).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fauth%2Fcallback");
  });

  it("accepts 127.0.0.1 host in development when DASHBOARD_BASE_URL is localhost", async () => {
    const response = await app.fetch(
      new Request("http://127.0.0.1:8787/login", {
        headers: { Host: "127.0.0.1:8787" }
      }),
      localEnv
    );

    expect(response.status).toBe(302);
  });

  it("keeps /register localhost behavior unchanged", async () => {
    const response = await app.fetch(
      new Request("http://localhost:8787/register", {
        headers: { Host: "localhost:8787" }
      }),
      localEnv
    );
    const location = response.headers.get("Location");

    expect(response.status).toBe(302);
    expect(location).toContain("screen_hint=sign-up");
  });

  it("does not reject dashboard.rslcollective.org host with a development host guard", async () => {
    const response = await app.fetch(
      new Request("http://dashboard.rslcollective.org/login", {
        headers: { Host: "dashboard.rslcollective.org" }
      }),
      localEnv
    );
    const location = response.headers.get("Location");

    expect(response.status).toBe(302);
    expect(location).toContain("https://api.workos.com/user_management/authorize");
    expect(location).not.toContain("invalid_development_host");
  });

  it("keeps /logout Origin validation unchanged behind a valid local host", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await app.fetch(
      new Request("http://localhost:8787/logout", {
        method: "POST",
        headers: {
          Host: "localhost:8787",
          Origin: "https://evil.example"
        }
      }),
      localEnv
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: {
        code: "forbidden",
        message: "Request origin is not allowed."
      }
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"origin_rejected"')
    );
    warnSpy.mockRestore();
  });

  it("keeps /api/company local unauthenticated behavior unchanged behind a valid local host", async () => {
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
