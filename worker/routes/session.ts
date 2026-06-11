import { Hono } from "hono";
import {
  getUserById as getUserByIdInDb,
  type UserRow
} from "../lib/db";
import {
  createD1SessionStore,
  validateSessionFromRequest,
  type SessionEnv,
  type SessionStore
} from "../lib/session";

type Bindings = SessionEnv & {
  DB: D1Database;
};

export type SessionRouteDeps = {
  createSessionStore: (db: D1Database) => SessionStore;
  getUserById: (db: D1Database, userId: string) => Promise<UserRow | null>;
};

const defaultDeps: SessionRouteDeps = {
  createSessionStore: createD1SessionStore,
  getUserById: getUserByIdInDb
};

export function createSessionRoutes(deps: SessionRouteDeps = defaultDeps) {
  const routes = new Hono<{ Bindings: Bindings }>();

  routes.get("/", async (c) => {
    const store = deps.createSessionStore(c.env.DB);
    const result = await validateSessionFromRequest(store, c.req.raw, c.env);

    if (!result.authenticated) {
      return c.json({ authenticated: false });
    }

    const user = await deps.getUserById(c.env.DB, result.session.user_id);

    if (!user) {
      return c.json({ authenticated: false });
    }

    c.header("Set-Cookie", result.cookie);

    return c.json({
      authenticated: true,
      user: mapSessionUser(user)
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
