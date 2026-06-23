import app from "../worker/index";

const env = {
  AUTH0_ISSUER_BASE_URL: "https://tenant.example.auth0.com",
  AUTH0_CLIENT_ID: "client_test",
  AUTH0_CLIENT_SECRET: "secret_test",
  AUTH0_CALLBACK_URL: "https://dashboard.rslcollective.org/auth/callback",
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
  AUTH0_CALLBACK_URL: undefined,
  DASHBOARD_BASE_URL: "http://localhost:8787",
  ENVIRONMENT: "development"
};

describe("Worker routing", () => {
  it("/auth/callback remains Worker-handled instead of SPA-handled", async () => {
    const response = await app.fetch(
      new Request("https://dashboard.rslcollective.org/auth/callback?code=test"),
      env
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(body).toContain("Sign-in link expired");
    expect(body).not.toContain("spa asset fallback");
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
    expect(location).toContain("https://tenant.example.auth0.com/authorize");
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
    expect(location).toContain("screen_hint=signup");
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
