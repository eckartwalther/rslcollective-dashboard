const workosMock = vi.hoisted(() => ({
  authenticateWithCode: vi.fn(),
  WorkOS: vi.fn()
}));

vi.mock("@workos-inc/node/worker", () => ({
  WorkOS: workosMock.WorkOS
}));

import { exchangeWorkosAuthorizationCode } from "../worker/lib/workos";

const env = {
  WORKOS_CLIENT_ID: "client_1234567890abcdef",
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  WORKOS_API_KEY: "sk_test_secret",
  SESSION_SECRET: "test-session-secret"
};

describe("WorkOS helper", () => {
  beforeEach(() => {
    workosMock.authenticateWithCode.mockReset();
    workosMock.WorkOS.mockReset();
    workosMock.WorkOS.mockImplementation(() => ({
      userManagement: {
        authenticateWithCode: workosMock.authenticateWithCode
      }
    }));
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
      refreshToken: "ignored_refresh_token"
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
      emailVerified: true
    });
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
});
