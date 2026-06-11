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
});
