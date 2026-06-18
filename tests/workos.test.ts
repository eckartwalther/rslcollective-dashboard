const workosMock = vi.hoisted(() => ({
  authenticateWithCode: vi.fn(),
  getLogoutUrl: vi.fn(),
  WorkOS: vi.fn()
}));

vi.mock("@workos-inc/node/worker", () => ({
  WorkOS: workosMock.WorkOS
}));

import {
  exchangeWorkosAuthorizationCode,
  getWorkosAuthorizationUrl,
  getWorkosLogoutUrl,
  getWorkosRedirectUri
} from "../worker/lib/workos";

const env = {
  WORKOS_CLIENT_ID: "client_1234567890abcdef",
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  WORKOS_API_KEY: "sk_test_secret",
  SESSION_SECRET: "test-session-secret"
};

describe("WorkOS helper", () => {
  beforeEach(() => {
    workosMock.authenticateWithCode.mockReset();
    workosMock.getLogoutUrl.mockReset();
    workosMock.WorkOS.mockReset();
    workosMock.WorkOS.mockImplementation(() => ({
      userManagement: {
        authenticateWithCode: workosMock.authenticateWithCode,
        getLogoutUrl: workosMock.getLogoutUrl
      }
    }));
    workosMock.getLogoutUrl.mockReturnValue(
      "https://api.workos.com/user_management/sessions/logout?session_id=workos_session_test&return_to=http%3A%2F%2Flocalhost%3A8787%2Flogin"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges authorization codes with the WorkOS SDK", async () => {
    workosMock.authenticateWithCode.mockResolvedValue({
      user: {
        id: "user_workos",
        email: "publisher@example.com",
        firstName: "Jane",
        lastName: "Publisher",
        emailVerified: true
      },
      accessToken: "ignored_access_token",
      refreshToken: "ignored_refresh_token",
      sessionId: "workos_session_test"
    });

    const user = await exchangeWorkosAuthorizationCode(
      { ...env, ENVIRONMENT: "production" },
      "code_valid"
    );

    expect(workosMock.WorkOS).toHaveBeenCalledWith("sk_test_secret");
    expect(workosMock.authenticateWithCode).toHaveBeenCalledWith({
      code: "code_valid",
      clientId: "client_1234567890abcdef"
    });
    expect(user).toEqual({
      id: "user_workos",
      email: "publisher@example.com",
      firstName: "Jane",
      lastName: "Publisher",
      emailVerified: true,
      sessionId: "workos_session_test"
    });
  });

  it("does not store or expose WorkOS access or refresh tokens in mapped auth data", async () => {
    workosMock.authenticateWithCode.mockResolvedValue({
      user: {
        id: "user_workos",
        email: "publisher@example.com"
      },
      accessToken: "ignored_access_token",
      refreshToken: "ignored_refresh_token",
      sessionId: "workos_session_test"
    });

    const user = await exchangeWorkosAuthorizationCode(
      { ...env, ENVIRONMENT: "production" },
      "code_valid"
    );

    expect(user).not.toHaveProperty("accessToken");
    expect(user).not.toHaveProperty("refreshToken");
    expect(user.sessionId).toBe("workos_session_test");
  });

  it("logs redacted exchange failure details outside production", async () => {
    const error = Object.assign(
      new Error(
        "Invalid client secret. code_secret sk_test_secret client_1234567890abcdef"
      ),
      {
        status: 401,
        rawData: {
          error: "invalid_client",
          error_description: "Invalid client secret.",
          echoedCode: "code_secret",
          echoedKey: "sk_test_secret",
          clientId: "client_1234567890abcdef"
        }
      }
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    workosMock.authenticateWithCode.mockRejectedValue(error);

    await expect(
      exchangeWorkosAuthorizationCode({ ...env, ENVIRONMENT: "development" }, "code_secret")
    ).rejects.toThrow("WorkOS authorization code exchange failed.");

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith({
      event: "workos_authorization_code_exchange_failed",
      workosExchangeResponseStatus: 401,
      workosExchangeResponseStatusText:
        "Invalid client secret. [redacted] [redacted] [redacted]",
      workosExchangeResponseBody: JSON.stringify({
        error: "invalid_client",
        error_description: "Invalid client secret.",
        echoedCode: "[redacted]",
        echoedKey: "[redacted]",
        clientId: "[redacted]"
      }),
      workosClientIdPresent: true,
      workosClientId: "client_12345...",
      workosApiKeyPresent: true,
      workosRedirectUri: "https://dashboard.rslcollective.org/auth/callback"
    });

    const loggedPayload = JSON.stringify(consoleError.mock.calls);

    expect(loggedPayload).not.toContain("sk_test_secret");
    expect(loggedPayload).not.toContain("code_secret");
    expect(loggedPayload).not.toContain("client_1234567890abcdef");
    expect(loggedPayload).not.toContain("Cookie");
    expect(loggedPayload).not.toContain("session");
  });

  it("does not log exchange failure details in production", async () => {
    const error = Object.assign(new Error("production failure body"), {
      status: 400,
      rawData: { error: "invalid_grant" }
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    workosMock.authenticateWithCode.mockRejectedValue(error);

    await expect(
      exchangeWorkosAuthorizationCode({ ...env, ENVIRONMENT: "production" }, "code_secret")
    ).rejects.toThrow("WorkOS authorization code exchange failed.");

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("uses DASHBOARD_BASE_URL for authorization callback URI outside production", async () => {
    const redirectUri = getWorkosRedirectUri({
      ...env,
      ENVIRONMENT: "development",
      DASHBOARD_BASE_URL: "http://localhost:8787"
    });
    const authorizationUrl = new URL(
      await getWorkosAuthorizationUrl(
        {
          ...env,
          ENVIRONMENT: "development",
          DASHBOARD_BASE_URL: "http://localhost:8787"
        },
        { flow: "login", returnTo: "/dashboard/company" }
      )
    );

    expect(redirectUri).toBe("http://localhost:8787/auth/callback");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:8787/auth/callback"
    );
    expect(authorizationUrl.toString()).not.toContain(
      "dashboard.rslcollective.org/auth/callback"
    );
  });

  it("uses configured WORKOS_REDIRECT_URI in production", async () => {
    expect(getWorkosRedirectUri({ ...env, ENVIRONMENT: "production" })).toBe(
      "https://dashboard.rslcollective.org/auth/callback"
    );
  });

  it("does not build a WorkOS logout URL without a WorkOS session ID", () => {
    expect(
      getWorkosLogoutUrl({
        ...env,
        ENVIRONMENT: "development",
        DASHBOARD_BASE_URL: "http://localhost:8787"
      }, null)
    ).toBeNull();
  });

  it("uses WorkOS session logout URL with login return target in development", () => {
    const logoutUrl = getWorkosLogoutUrl({
      ...env,
      ENVIRONMENT: "development",
      DASHBOARD_BASE_URL: "http://localhost:8787"
    }, "workos_session_test");

    expect(logoutUrl).not.toBeNull();
    expect(workosMock.getLogoutUrl).toHaveBeenCalledWith({
      sessionId: "workos_session_test",
      returnTo: "http://localhost:8787/login"
    });
    expect(logoutUrl).not.toContain("dashboard.rslcollective.org");
  });

  it("uses WorkOS session logout URL with login return target in production", () => {
    const logoutUrl = getWorkosLogoutUrl({
      ...env,
      ENVIRONMENT: "production",
      DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org"
    }, "workos_session_test");

    expect(logoutUrl).not.toBeNull();
    expect(workosMock.getLogoutUrl).toHaveBeenCalledWith({
      sessionId: "workos_session_test",
      returnTo: "https://dashboard.rslcollective.org/login"
    });
  });
});
