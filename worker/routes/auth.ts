import { Hono, type Context } from "hono";
import { requireValidOrigin, type OriginEnv } from "../lib/csrf";
import { serverError, validationError } from "../lib/responses";
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
  createUserFromWorkos as createUserFromWorkosInDb,
  getUserByWorkosUserId as getUserByWorkosUserIdInDb,
  updateUserFromWorkos as updateUserFromWorkosInDb,
  type UserRow,
  type WorkosUserData
} from "../lib/db";
import {
  exchangeWorkosAuthorizationCode,
  getWorkosLogoutUrl,
  getWorkosAuthorizationUrl,
  type WorkosAuthenticatedUser,
  type WorkosAuthEnv
} from "../lib/workos";

type Bindings = OriginEnv &
  SessionEnv &
  WorkosAuthEnv & {
    DB: D1Database;
  };

export type AuthRouteDeps = {
  createSessionStore: (db: D1Database) => SessionStore;
  exchangeAuthorizationCode: (
    env: WorkosAuthEnv,
    code: string
  ) => Promise<WorkosAuthenticatedUser>;
  getUserByWorkosUserId: (
    db: D1Database,
    workosUserId: string
  ) => Promise<UserRow | null>;
  createUserFromWorkos: (
    db: D1Database,
    user: WorkosUserData
  ) => Promise<UserRow | null>;
  updateUserFromWorkos: (
    db: D1Database,
    user: WorkosUserData
  ) => Promise<UserRow | null>;
  getLogoutUrl: (env: WorkosAuthEnv, sessionId: string | null | undefined) => string | null;
};

const defaultDeps: AuthRouteDeps = {
  createSessionStore: createD1SessionStore,
  exchangeAuthorizationCode: exchangeWorkosAuthorizationCode,
  getUserByWorkosUserId: getUserByWorkosUserIdInDb,
  createUserFromWorkos: createUserFromWorkosInDb,
  updateUserFromWorkos: updateUserFromWorkosInDb,
  getLogoutUrl: getWorkosLogoutUrl
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
        ? validationError(c, "Invalid returnTo path.")
        : serverError(c, "WorkOS authorization is not configured.");
  });

  routes.get("/login", async (c) => {
    const result = await buildAuthorizationRedirect(c.env, "login", c.req.query("returnTo"));
    return result.status === "ok"
      ? c.redirect(result.url)
      : result.status === "invalid_return_to"
        ? validationError(c, "Invalid returnTo path.")
        : serverError(c, "WorkOS authorization is not configured.");
  });

  routes.get("/auth/callback", async (c) => handleAuthCallback(c, deps));

  routes.post("/logout", async (c) => {
    const originError = requireValidOrigin(c);

    if (originError) {
      return originError;
    }

    const store = deps.createSessionStore(c.env.DB);
    const deleteResult = await deleteSessionFromRequest(store, c.req.raw, c.env);
    const logoutUrl = deps.getLogoutUrl(c.env, deleteResult.session?.workos_session_id);
    const redirectUrl = logoutUrl ?? "/login";

    for (const clearCookie of deleteResult.cookies) {
      c.header("Set-Cookie", clearCookie, { append: true });
    }

    return c.redirect(redirectUrl);
  });

  return routes;
}

export const authRoutes = createAuthRoutes();

async function handleAuthCallback(c: Context<{ Bindings: Bindings }>, deps: AuthRouteDeps) {
  const stateResult = await validateSignedAuthState(c.req.query("state"), c.env.SESSION_SECRET ?? "");

  if (!stateResult.valid) {
    return validationError(c, "Invalid authentication state.", {
      state: stateResult.reason
    });
  }

  const code = c.req.query("code");

  if (!code) {
    return validationError(c, "Authorization code is required.", {
      code: "missing"
    });
  }

  let workosUser: WorkosAuthenticatedUser;

  try {
    workosUser = await deps.exchangeAuthorizationCode(c.env, code);
  } catch {
    return serverError(c, "WorkOS authorization code exchange failed.");
  }

  const userData = mapWorkosUser(workosUser);
  const existingUser = await deps.getUserByWorkosUserId(c.env.DB, userData.workosUserId);
  const user = existingUser
    ? await deps.updateUserFromWorkos(c.env.DB, userData)
    : await deps.createUserFromWorkos(c.env.DB, userData);

  if (!user) {
    return serverError(c, "Local user could not be saved.");
  }

  const session = await createLocalSession(
    deps.createSessionStore(c.env.DB),
    user.id,
    c.env,
    workosUser.sessionId
  );

  if (!session.session) {
    return serverError(c, "Local session could not be created.");
  }

  c.header("Set-Cookie", session.cookie);

  return c.redirect(stateResult.payload.returnTo ?? "/dashboard");
}

async function buildAuthorizationRedirect(
  env: WorkosAuthEnv,
  flow: "register" | "login",
  returnTo: string | undefined
) {
  try {
    return {
      status: "ok" as const,
      url: await getWorkosAuthorizationUrl(env, {
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

function mapWorkosUser(user: WorkosAuthenticatedUser): WorkosUserData {
  return {
    workosUserId: user.id,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    emailVerified: user.emailVerified ?? false
  };
}
