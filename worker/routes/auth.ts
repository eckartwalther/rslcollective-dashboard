import { Hono, type Context } from "hono";
import { requireValidOrigin, type OriginEnv } from "../lib/csrf";
import {
  authenticationCouldNotCompletePage,
  emailVerificationRequiredPage,
  signInLinkExpiredPage
} from "../lib/error-pages";
import { serverError } from "../lib/responses";
import {
  createD1SessionStore,
  createLocalSession,
  deleteSessionFromRequest,
  validateSessionFromRequest,
  validateSignedAuthState,
  type SessionEnv,
  type SessionStore
} from "../lib/session";
import {
  createUserFromAuthIdentity as createUserFromAuthIdentityInDb,
  getUserByAuthIdentity as getUserByAuthIdentityInDb,
  updateUserFromAuthIdentity as updateUserFromAuthIdentityInDb,
  type AuthenticatedUserData,
  type UserRow,
} from "../lib/db";
import {
  exchangeAuth0AuthorizationCode,
  getAuth0AuthorizationUrl,
  getAuth0LogoutUrl,
  isAuth0AuthError,
  type Auth0AuthenticatedUser,
  type Auth0AuthEnv
} from "../lib/auth0";

type Bindings = OriginEnv &
  SessionEnv &
  Auth0AuthEnv & {
    DB: D1Database;
  };

export type AuthRouteDeps = {
  createSessionStore: (db: D1Database) => SessionStore;
  exchangeAuthorizationCode: (
    env: Auth0AuthEnv,
    code: string,
    nonce: string
  ) => Promise<Auth0AuthenticatedUser>;
  getUserByAuthIdentity: (
    db: D1Database,
    authProvider: string,
    authSubject: string
  ) => Promise<UserRow | null>;
  createUserFromAuthIdentity: (
    db: D1Database,
    user: AuthenticatedUserData
  ) => Promise<UserRow | null>;
  updateUserFromAuthIdentity: (
    db: D1Database,
    user: AuthenticatedUserData
  ) => Promise<UserRow | null>;
  getLogoutUrl: (env: Auth0AuthEnv) => string | null;
};

const defaultDeps: AuthRouteDeps = {
  createSessionStore: createD1SessionStore,
  exchangeAuthorizationCode: exchangeAuth0AuthorizationCode,
  getUserByAuthIdentity: getUserByAuthIdentityInDb,
  createUserFromAuthIdentity: createUserFromAuthIdentityInDb,
  updateUserFromAuthIdentity: updateUserFromAuthIdentityInDb,
  getLogoutUrl: getAuth0LogoutUrl
};

export function createAuthRoutes(deps: AuthRouteDeps = defaultDeps) {
  const routes = new Hono<{ Bindings: Bindings }>();

  routes.get("/", async (c) => {
    const store = deps.createSessionStore(c.env.DB);
    const session = await validateSessionFromRequest(store, c.req.raw, c.env);

    if (!session.authenticated) {
      return c.redirect("/login");
    }

    c.header("Set-Cookie", session.cookie);
    return c.redirect("/dashboard");
  });

  routes.get("/register", async (c) => {
    const result = await buildAuthorizationRedirect(c.env, "register", c.req.query("returnTo"));
    return result.status === "ok"
      ? c.redirect(result.url)
      : result.status === "invalid_return_to"
        ? authenticationCouldNotCompletePage(c)
        : serverError(c, "Auth0 authorization is not configured.");
  });

  routes.get("/login", async (c) => {
    const result = await buildAuthorizationRedirect(c.env, "login", c.req.query("returnTo"));
    return result.status === "ok"
      ? c.redirect(result.url)
      : result.status === "invalid_return_to"
        ? authenticationCouldNotCompletePage(c)
        : serverError(c, "Auth0 authorization is not configured.");
  });

  routes.get("/auth/callback", async (c) => handleAuthCallback(c, deps));

  routes.post("/logout", async (c) => {
    const originError = requireValidOrigin(c);

    if (originError) {
      return originError;
    }

    const store = deps.createSessionStore(c.env.DB);
    const deleteResult = await deleteSessionFromRequest(store, c.req.raw, c.env);
    const logoutUrl = getLogoutUrlSafely(c.env, deps);
    const redirectUrl = logoutUrl ?? "/login";

    for (const clearCookie of deleteResult.cookies) {
      c.header("Set-Cookie", clearCookie, { append: true });
    }

    return c.redirect(redirectUrl);
  });

  return routes;
}

export const authRoutes = createAuthRoutes();

function getLogoutUrlSafely(env: Auth0AuthEnv, deps: AuthRouteDeps) {
  try {
    return deps.getLogoutUrl(env);
  } catch {
    return null;
  }
}

async function handleAuthCallback(c: Context<{ Bindings: Bindings }>, deps: AuthRouteDeps) {
  if (!c.env.SESSION_SECRET) {
    return serverError(c, "Auth0 authorization is not configured.");
  }

  const stateResult = await validateSignedAuthState(c.req.query("state"), c.env.SESSION_SECRET);

  if (!stateResult.valid) {
    return signInLinkExpiredPage(c);
  }

  const code = c.req.query("code");

  if (!code) {
    return authenticationCouldNotCompletePage(c);
  }

  let auth0User: Auth0AuthenticatedUser;

  try {
    auth0User = await deps.exchangeAuthorizationCode(c.env, code, stateResult.payload.nonce);
  } catch (error) {
    logAuth0CallbackFailure(c.env, error);

    if (isAuth0AuthError(error) && error.code === "email_unverified") {
      return emailVerificationRequiredPage(c);
    }

    return authenticationCouldNotCompletePage(c, 500);
  }

  const userData = mapAuth0User(auth0User);
  const existingUser = await deps.getUserByAuthIdentity(
    c.env.DB,
    userData.authProvider,
    userData.authSubject
  );
  const user = existingUser
    ? await deps.updateUserFromAuthIdentity(c.env.DB, userData)
    : await deps.createUserFromAuthIdentity(c.env.DB, userData);

  if (!user) {
    return serverError(c, "Local user could not be saved.");
  }

  const session = await createLocalSession(
    deps.createSessionStore(c.env.DB),
    user.id,
    c.env
  );

  if (!session.session) {
    return serverError(c, "Local session could not be created.");
  }

  c.header("Set-Cookie", session.cookie);

  return c.redirect(stateResult.payload.returnTo ?? "/dashboard");
}

async function buildAuthorizationRedirect(
  env: Auth0AuthEnv,
  flow: "register" | "login",
  returnTo: string | undefined
) {
  try {
    return {
      status: "ok" as const,
      url: await getAuth0AuthorizationUrl(env, {
        flow,
        returnTo
      })
    };
  } catch (error) {
    return {
      status:
        error instanceof Error && error.message === "Invalid returnTo path."
          ? ("invalid_return_to" as const)
          : ("invalid_config" as const)
    };
  }
}

function logAuth0CallbackFailure(env: Auth0AuthEnv, error: unknown) {
  if (env.ENVIRONMENT === "production") {
    return;
  }

  console.warn(
    JSON.stringify({
      event: "auth0_callback_failed",
      category: isAuth0AuthError(error) ? error.code : "unknown"
    })
  );
}

function mapAuth0User(user: Auth0AuthenticatedUser): AuthenticatedUserData {
  return {
    authProvider: user.authProvider,
    authSubject: user.authSubject,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    emailVerified: user.emailVerified
  };
}
