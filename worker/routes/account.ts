import { Hono, type Context } from "hono";
import {
  authenticateClerkRequest,
  defaultClerkAuthDeps,
  deleteClerkUser as deleteClerkUserWithBackend,
  type ClerkAuthDeps,
  type ClerkEnv
} from "../lib/clerk";
import {
  deleteLocalAccountData as deleteLocalAccountDataInDb,
  type DeleteLocalAccountDataResult
} from "../lib/db";
import { serverError, unauthenticated } from "../lib/responses";

type Bindings = ClerkEnv & {
  DB: D1Database;
};

export type AccountRouteDeps = {
  clerkAuth: ClerkAuthDeps;
  deleteLocalAccountData: (
    db: D1Database,
    userId: string
  ) => Promise<DeleteLocalAccountDataResult>;
  deleteClerkUser: (env: ClerkEnv, clerkUserId: string) => Promise<void>;
};

const defaultDeps: AccountRouteDeps = {
  clerkAuth: defaultClerkAuthDeps,
  deleteLocalAccountData: deleteLocalAccountDataInDb,
  deleteClerkUser: deleteClerkUserWithBackend
};

export function createAccountRoutes(deps: AccountRouteDeps = defaultDeps) {
  const routes = new Hono<{ Bindings: Bindings }>();

  routes.delete("/", async (c) => {
    const auth = await authenticateClerkRequest(
      c.env.DB,
      c.req.raw,
      c.env,
      deps.clerkAuth
    );

    if (!auth) {
      return unauthenticated(c);
    }

    try {
      await deps.deleteClerkUser(c.env, auth.clerkUserId);
    } catch (error) {
      logAccountDeletionError(c, "account_clerk_deletion_failed", error, {
        localUserId: auth.user.id,
        clerkUserId: auth.clerkUserId
      });
      return serverError(c, "Your account could not be deleted. Please try again or contact support.");
    }

    try {
      await deps.deleteLocalAccountData(c.env.DB, auth.user.id);
    } catch (error) {
      logAccountDeletionError(c, "account_local_cleanup_failed", error, {
        localUserId: auth.user.id,
        clerkUserId: auth.clerkUserId
      });
      return serverError(c, "Your account was deleted, but we could not finish cleanup. Please contact support.");
    }

    clearDashboardSessionCookies(c);
    return c.json({ deleted: true });
  });

  return routes;
}

export const accountRoutes = createAccountRoutes();

function clearDashboardSessionCookies(c: Context) {
  for (const cookieName of ["__Host-rsl_dashboard_session", "rsl_dashboard_session"]) {
    c.header(
      "Set-Cookie",
      `${cookieName}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
      { append: true }
    );
  }
}

function logAccountDeletionError(
  c: Context,
  event: "account_clerk_deletion_failed" | "account_local_cleanup_failed",
  error: unknown,
  ids: { localUserId: string; clerkUserId: string }
) {
  console.error(
    JSON.stringify({
      event,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      localUserId: ids.localUserId,
      clerkUserId: ids.clerkUserId,
      errorName: error instanceof Error ? error.name : typeof error
    })
  );
}
