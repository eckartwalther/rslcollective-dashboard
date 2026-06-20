import { authRoutes } from "../worker/routes/auth";
import {
  AUTH_STATE_TTL_MS,
  DEVELOPMENT_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  createSignedAuthState,
  validateSignedAuthState
} from "../worker/lib/session";

const env = {
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  SESSION_SECRET: "test-session-secret",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  ENVIRONMENT: "production",
  DB: {} as D1Database
};

const localEnv = {
  ...env,
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  DASHBOARD_BASE_URL: "http://localhost:8787",
  ENVIRONMENT: "development"
};

async function getRedirect(path: string) {
  const response = await authRoutes.fetch(
    new Request(`https://dashboard.rslcollective.org${path}`),
    env
  );
  const location = response.headers.get("Location");

  if (!location) {
    throw new Error("Missing Location header.");
  }

  return {
    response,
    location,
    url: new URL(location)
  };
}

describe("AuthKit authorization routes", () => {
  it("/register returns a WorkOS/AuthKit redirect", async () => {
    const { response, url } = await getRedirect("/register");

    expect(response.status).toBe(302);
    expect(url.origin).toBe("https://api.workos.com");
    expect(url.pathname).toBe("/user_management/authorize");
    expect(url.searchParams.get("screen_hint")).toBe("sign-up");
  });

  it("/login returns a WorkOS/AuthKit redirect", async () => {
    const { response, url } = await getRedirect("/login");

    expect(response.status).toBe(302);
    expect(url.origin).toBe("https://api.workos.com");
    expect(url.pathname).toBe("/user_management/authorize");
    expect(url.searchParams.get("screen_hint")).toBe("sign-in");
  });

  it("redirect URL includes provider authkit behavior and redirect URI", async () => {
    const { url } = await getRedirect("/register");

    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client_test");
    expect(url.searchParams.get("provider")).toBe("authkit");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://dashboard.rslcollective.org/auth/callback"
    );
  });

  it("uses DASHBOARD_BASE_URL for local development WorkOS redirect URI", async () => {
    const response = await authRoutes.fetch(new Request("http://localhost:8787/login"), localEnv);
    const location = response.headers.get("Location");

    if (!location) {
      throw new Error("Missing Location header.");
    }

    const url = new URL(location);

    expect(response.status).toBe(302);
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8787/auth/callback");
    expect(url.toString()).not.toContain("dashboard.rslcollective.org/auth/callback");
  });

  it("uses DASHBOARD_BASE_URL for local development register redirect URI", async () => {
    const response = await authRoutes.fetch(new Request("http://localhost:8787/register"), localEnv);
    const location = response.headers.get("Location");

    if (!location) {
      throw new Error("Missing Location header.");
    }

    const url = new URL(location);

    expect(response.status).toBe(302);
    expect(url.searchParams.get("screen_hint")).toBe("sign-up");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8787/auth/callback");
    expect(url.toString()).not.toContain("dashboard.rslcollective.org/auth/callback");
  });

  it("falls back to local /login on development logout without a WorkOS session ID", async () => {
    const response = await authRoutes.fetch(
      new Request("http://localhost:8787/logout", {
        method: "POST",
        headers: { Origin: "http://localhost:8787" }
      }),
      localEnv
    );
    const cookie = response.headers.get("Set-Cookie");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    expect(response.headers.get("Location")).not.toContain("dashboard.rslcollective.org");
    expect(cookie).toContain(`${DEVELOPMENT_SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("includes signed state that validates when untampered", async () => {
    const { url } = await getRedirect("/login?returnTo=/dashboard/profile");
    const state = url.searchParams.get("state");

    expect(state).toBeTruthy();

    const result = await validateSignedAuthState(state, env.SESSION_SECRET);

    expect(result.valid).toBe(true);
    expect(result.valid && result.payload.flow).toBe("login");
    expect(result.valid && result.payload.returnTo).toBe("/dashboard/profile");
    expect(result.valid && result.payload.nonce).toEqual(expect.any(String));
    expect(result.valid && result.payload.iat).toEqual(expect.any(Number));
  });

  it("preserves local returnTo as a relative path in signed state", async () => {
    const response = await authRoutes.fetch(
      new Request("http://localhost:8787/login?returnTo=/dashboard/company"),
      localEnv
    );
    const location = response.headers.get("Location");

    if (!location) {
      throw new Error("Missing Location header.");
    }

    const state = new URL(location).searchParams.get("state");
    const result = await validateSignedAuthState(state, localEnv.SESSION_SECRET);

    expect(result.valid).toBe(true);
    expect(result.valid && result.payload.returnTo).toBe("/dashboard/company");
    expect(JSON.stringify(result)).not.toContain("dashboard.rslcollective.org/dashboard/company");
  });

  it("rejects malformed state", async () => {
    await expect(validateSignedAuthState("malformed", env.SESSION_SECRET)).resolves.toEqual({
      valid: false,
      reason: "malformed"
    });
  });

  it("rejects tampered state", async () => {
    const state = await createSignedAuthState({
      flow: "register",
      secret: env.SESSION_SECRET,
      now: new Date("2026-06-11T00:00:00.000Z")
    });
    const result = await validateSignedAuthState(`${state}tampered`, env.SESSION_SECRET, {
      now: new Date("2026-06-11T00:01:00.000Z")
    });

    expect(result).toEqual({ valid: false, reason: "tampered" });
  });

  it("rejects expired state", async () => {
    const state = await createSignedAuthState({
      flow: "login",
      secret: env.SESSION_SECRET,
      now: new Date("2026-06-11T00:00:00.000Z")
    });
    const result = await validateSignedAuthState(state, env.SESSION_SECRET, {
      now: new Date(1465430400000 + AUTH_STATE_TTL_MS + 1)
    });

    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects unsupported flow in signed state", async () => {
    const state = await createSignedAuthState({
      flow: "unsupported" as never,
      secret: env.SESSION_SECRET,
      now: new Date("2026-06-11T00:00:00.000Z")
    });
    const result = await validateSignedAuthState(state, env.SESSION_SECRET, {
      now: new Date("2026-06-11T00:01:00.000Z")
    });

    expect(result).toEqual({ valid: false, reason: "unsupported_flow" });
  });

  it("rejects external returnTo values", async () => {
    const response = await authRoutes.fetch(
      new Request(
        "https://dashboard.rslcollective.org/login?returnTo=https%3A%2F%2Fevil.example%2Fpath"
      ),
      env
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("Authentication could not be completed");
    expect(body).toContain('href="/login"');
    expect(body).toContain('href="/register"');
    expect(body).not.toContain("evil.example");
  });

  it("fails clearly when WorkOS authorization config is missing", async () => {
    const response = await authRoutes.fetch(
      new Request("https://dashboard.rslcollective.org/register"),
      {
        SESSION_SECRET: "test-session-secret",
        DB: {} as D1Database
      }
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "server_error",
        message: "WorkOS authorization is not configured."
      }
    });
  });
});
