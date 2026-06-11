import { exchangeWorkosAuthorizationCode } from "../worker/lib/workos";

const env = {
  WORKOS_CLIENT_ID: "client_1234567890abcdef",
  WORKOS_REDIRECT_URI: "https://dashboard.rslcollective.org/auth/callback",
  WORKOS_API_KEY: "sk_test_secret",
  SESSION_SECRET: "test-session-secret"
};

describe("WorkOS helper logging", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs redacted exchange failure details outside production", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          echoedCode: "code_secret",
          echoedKey: "sk_test_secret"
        }),
        {
          status: 401,
          statusText: "Unauthorized"
        }
      )
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeWorkosAuthorizationCode({ ...env, ENVIRONMENT: "development" }, "code_secret")
    ).rejects.toThrow("WorkOS authorization code exchange failed.");

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith({
      event: "workos_authorization_code_exchange_failed",
      workosExchangeResponseStatus: 401,
      workosExchangeResponseStatusText: "Unauthorized",
      workosExchangeResponseBody: JSON.stringify({
        error: "invalid_grant",
        echoedCode: "[redacted]",
        echoedKey: "[redacted]"
      }),
      workosClientIdPresent: true,
      workosClientId: "client_12345...",
      workosApiKeyPresent: true,
      workosRedirectUri: "https://dashboard.rslcollective.org/auth/callback"
    });

    const loggedPayload = JSON.stringify(consoleError.mock.calls);

    expect(loggedPayload).not.toContain("sk_test_secret");
    expect(loggedPayload).not.toContain("code_secret");
    expect(loggedPayload).not.toContain("Cookie");
    expect(loggedPayload).not.toContain("session");
  });

  it("does not log exchange failure details in production", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("production failure body", {
        status: 400,
        statusText: "Bad Request"
      })
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeWorkosAuthorizationCode({ ...env, ENVIRONMENT: "production" }, "code_secret")
    ).rejects.toThrow("WorkOS authorization code exchange failed.");

    expect(consoleError).not.toHaveBeenCalled();
  });
});
