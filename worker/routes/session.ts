import { Hono } from "hono";
import {
  type UserRow
} from "../lib/db";
import {
  authenticateClerkRequest,
  defaultClerkAuthDeps,
  type ClerkAuthDeps,
  type ClerkEnv
} from "../lib/clerk";

type Bindings = ClerkEnv & {
  DB: D1Database;
};

export type SessionRouteDeps = {
  clerkAuth: ClerkAuthDeps;
};

const defaultDeps: SessionRouteDeps = {
  clerkAuth: defaultClerkAuthDeps
};

export function createSessionRoutes(deps: SessionRouteDeps = defaultDeps) {
  const routes = new Hono<{ Bindings: Bindings }>();

  routes.get("/", async (c) => {
    const result = await authenticateClerkRequest(
      c.env.DB,
      c.req.raw,
      c.env,
      { syncUser: true },
      deps.clerkAuth
    );

    if (!result) {
      return c.json({ authenticated: false });
    }

    return c.json({
      authenticated: true,
      user: mapSessionUser(result.user)
    });
  });

  return routes;
}

export const sessionRoutes = createSessionRoutes();

function mapSessionUser(user: UserRow) {
  return {
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    hasCompany: user.company_id !== null
  };
}
