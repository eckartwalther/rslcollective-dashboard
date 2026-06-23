// @vitest-environment node
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  Auth0AuthError,
  AUTH0_PROVIDER,
  exchangeAuth0AuthorizationCode,
  getAuth0AuthorizationUrl,
  getAuth0CallbackUrl,
  getAuth0Issuer,
  getAuth0LogoutUrl,
  validateAuth0IdToken
} from "../worker/lib/auth0";

const env = {
  AUTH0_ISSUER_BASE_URL: "https://tenant.example.auth0.com",
  AUTH0_CLIENT_ID: "client_1234567890abcdef",
  AUTH0_CLIENT_SECRET: "secret_test",
  AUTH0_CALLBACK_URL: "https://dashboard.rslcollective.org/auth/callback",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org",
  SESSION_SECRET: "test-session-secret"
};

async function createSignedIdToken(
  claims: Record<string, unknown> = {},
  options: { issuer?: string; audience?: string; expiresInSeconds?: number; issuedAt?: number } = {}
) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const jwks = {
    keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }]
  };
  const keySet = createLocalJWKSet({
    keys: jwks.keys
  });
  const now = options.issuedAt ?? Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    sub: "auth0|user_test",
    email: "publisher@example.com",
    email_verified: true,
    given_name: "Jane",
    family_name: "Publisher",
    nonce: "nonce_test",
    ...claims
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer ?? "https://tenant.example.auth0.com/")
    .setAudience(options.audience ?? "client_1234567890abcdef")
    .setIssuedAt(now)
    .setExpirationTime(now + (options.expiresInSeconds ?? 300))
    .sign(privateKey);

  return { token, keySet, jwks };
}

describe("Auth0 helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds authorize URLs from AUTH0_ISSUER_BASE_URL", async () => {
    const authorizationUrl = new URL(
      await getAuth0AuthorizationUrl(env, { flow: "login", returnTo: "/dashboard/company" })
    );

    expect(authorizationUrl.origin).toBe("https://tenant.example.auth0.com");
    expect(authorizationUrl.pathname).toBe("/authorize");
    expect(authorizationUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizationUrl.searchParams.get("client_id")).toBe(env.AUTH0_CLIENT_ID);
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid profile email");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      "https://dashboard.rslcollective.org/auth/callback"
    );
    expect(authorizationUrl.searchParams.get("nonce")).toEqual(expect.any(String));
  });

  it("adds screen_hint=signup for registration", async () => {
    const authorizationUrl = new URL(await getAuth0AuthorizationUrl(env, { flow: "register" }));

    expect(authorizationUrl.searchParams.get("screen_hint")).toBe("signup");
  });

  it("derives callback URL from DASHBOARD_BASE_URL when AUTH0_CALLBACK_URL is not set", () => {
    expect(
      getAuth0CallbackUrl({
        ...env,
        AUTH0_CALLBACK_URL: undefined,
        DASHBOARD_BASE_URL: "http://localhost:8787"
      })
    ).toBe("http://localhost:8787/auth/callback");
  });

  it("normalizes issuer with trailing slash", () => {
    expect(getAuth0Issuer({ ...env, AUTH0_ISSUER_BASE_URL: "https://tenant.example.auth0.com/" }))
      .toBe("https://tenant.example.auth0.com/");
  });

  it("validates signed ID tokens and maps verified Auth0 identity", async () => {
    const { token, keySet } = await createSignedIdToken();

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).resolves.toEqual({
      authProvider: AUTH0_PROVIDER,
      authSubject: "auth0|user_test",
      email: "publisher@example.com",
      firstName: "Jane",
      lastName: "Publisher",
      emailVerified: true
    });
  });

  it("rejects ID tokens with invalid nonce", async () => {
    const { token, keySet } = await createSignedIdToken();

    await expect(validateAuth0IdToken(env, token, "wrong_nonce", keySet)).rejects.toThrow();
  });

  it("rejects ID tokens with invalid issuer", async () => {
    const { token, keySet } = await createSignedIdToken(
      {},
      { issuer: "https://other.example.auth0.com/" }
    );

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toThrow();
  });

  it("rejects ID tokens with invalid audience", async () => {
    const { token, keySet } = await createSignedIdToken({}, { audience: "other_client" });

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toThrow();
  });

  it("rejects expired ID tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { token, keySet } = await createSignedIdToken(
      {},
      { issuedAt: now - 600, expiresInSeconds: -300 }
    );

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toThrow();
  });

  it("rejects ID tokens with future issued-at beyond clock tolerance", async () => {
    const future = Math.floor(Date.now() / 1000) + 300;
    const { token, keySet } = await createSignedIdToken({}, { issuedAt: future });

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toThrow(
      "Auth0 ID token issued-at time is in the future."
    );
  });

  it("rejects ID tokens without subject", async () => {
    const { token, keySet } = await createSignedIdToken({ sub: "" });

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toThrow(
      "Auth0 ID token did not include a subject."
    );
  });

  it("rejects ID tokens without email", async () => {
    const { token, keySet } = await createSignedIdToken({ email: "" });

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toThrow(
      "Auth0 ID token did not include an email."
    );
  });

  it("rejects ID tokens unless email_verified is true", async () => {
    const { token, keySet } = await createSignedIdToken({ email_verified: false });

    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toThrow(
      "Auth0 ID token email is not verified."
    );
    await expect(validateAuth0IdToken(env, token, "nonce_test", keySet)).rejects.toMatchObject({
      code: "email_unverified"
    } satisfies Partial<Auth0AuthError>);
  });

  it("exchanges authorization codes server-side and does not expose provider tokens in mapped auth data", async () => {
    const { token, jwks } = await createSignedIdToken();
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url =
        input instanceof URL ? input.toString() : input instanceof Request ? input.url : String(input);

      if (url === "https://tenant.example.auth0.com/oauth/token") {
        return new Response(
          JSON.stringify({
            id_token: token,
            access_token: "ignored_access_token",
            refresh_token: "ignored_refresh_token",
            token_type: "Bearer"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url === "https://tenant.example.auth0.com/.well-known/jwks.json") {
        return new Response(JSON.stringify(jwks), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = await exchangeAuth0AuthorizationCode(env, "code_valid", "nonce_test");

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://tenant.example.auth0.com/oauth/token"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        }
      })
    );
    const tokenRequest = fetchMock.mock.calls.find(
      ([input]) => input instanceof URL && input.pathname === "/oauth/token"
    ) as [URL, RequestInit] | undefined;
    const requestBody = tokenRequest?.[1].body as URLSearchParams;
    expect(requestBody.get("grant_type")).toBe("authorization_code");
    expect(requestBody.get("client_id")).toBe(env.AUTH0_CLIENT_ID);
    expect(requestBody.get("client_secret")).toBe(env.AUTH0_CLIENT_SECRET);
    expect(requestBody.get("code")).toBe("code_valid");
    expect(requestBody.get("redirect_uri")).toBe(env.AUTH0_CALLBACK_URL);
    expect(user).not.toHaveProperty("idToken");
    expect(user).not.toHaveProperty("accessToken");
    expect(user).not.toHaveProperty("refreshToken");
    expect(user).toMatchObject({
      authProvider: "auth0",
      authSubject: "auth0|user_test",
      email: "publisher@example.com"
    });
  });

  it("logs redacted exchange failure details outside production", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: "Invalid client secret.",
            echoedCode: "code_secret",
            echoedSecret: "secret_test",
            clientId: env.AUTH0_CLIENT_ID
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(
      exchangeAuth0AuthorizationCode({ ...env, ENVIRONMENT: "development" }, "code_secret", "nonce_test")
    ).rejects.toThrow("Auth0 authorization code exchange failed.");

    expect(consoleError).toHaveBeenCalledTimes(1);
    const loggedPayload = JSON.stringify(consoleError.mock.calls);
    expect(loggedPayload).toContain("auth0_authorization_code_exchange_failed");
    expect(loggedPayload).not.toContain("secret_test");
    expect(loggedPayload).not.toContain("code_secret");
    expect(loggedPayload).not.toContain(env.AUTH0_CLIENT_ID);
  });

  it("does not log exchange failure details in production", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(
      exchangeAuth0AuthorizationCode({ ...env, ENVIRONMENT: "production" }, "code_secret", "nonce_test")
    ).rejects.toThrow("Auth0 authorization code exchange failed.");

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("builds Auth0 logout URL with dashboard login return target", () => {
    const logoutUrl = new URL(getAuth0LogoutUrl(env) ?? "");

    expect(logoutUrl.origin).toBe("https://tenant.example.auth0.com");
    expect(logoutUrl.pathname).toBe("/v2/logout");
    expect(logoutUrl.searchParams.get("client_id")).toBe(env.AUTH0_CLIENT_ID);
    expect(logoutUrl.searchParams.get("returnTo")).toBe("https://dashboard.rslcollective.org/login");
  });
});
