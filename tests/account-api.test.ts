// @vitest-environment node
/// <reference types="vite/client" />

import { Miniflare } from "miniflare";

import coreMigration from "../migrations/0001_core.sql?raw";
import { CLERK_PROVIDER, type ClerkAuthDeps, type ClerkBackendUser } from "../worker/lib/clerk";
import {
  createUserFromAuthIdentity,
  deleteLocalAccountData,
  getUserByAuthIdentity,
  type UserRow
} from "../worker/lib/db";
import { createAccountRoutes, type AccountRouteDeps } from "../worker/routes/account";

const timestamp = "2026-06-11T00:00:00.000Z";

const env = {
  CLERK_AUTHORIZED_PARTIES: "https://dashboard.rslcollective.org",
  CLERK_SECRET_KEY: "sk_test_mock",
  ENVIRONMENT: "production",
  DASHBOARD_BASE_URL: "https://dashboard.rslcollective.org"
};

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_current",
    auth_provider: CLERK_PROVIDER,
    auth_subject: "user_clerk_current",
    company_id: "cmp_current",
    email: "current@example.com",
    first_name: "Current",
    last_name: "User",
    email_verified: 1,
    role: "owner",
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  };
}

function createClerkUser(overrides: Partial<ClerkBackendUser> = {}): ClerkBackendUser {
  return {
    id: "user_clerk_current",
    firstName: "Current",
    lastName: "User",
    primaryEmailAddressId: "idn_email",
    emailAddresses: [
      {
        id: "idn_email",
        emailAddress: "current@example.com",
        verification: { status: "verified" }
      }
    ],
    ...overrides
  };
}

function createMockDeps(options: { authenticated?: boolean; clerkDeleteError?: unknown } = {}) {
  const currentUser = createUser();
  const clerkAuth: ClerkAuthDeps = {
    verifyToken: vi.fn(async () => ({ sub: "user_clerk_current" })) as unknown as ClerkAuthDeps["verifyToken"],
    getClerkUser: vi.fn(async () => createClerkUser()),
    getUserByAuthIdentity: vi.fn(async () =>
      options.authenticated === false ? null : currentUser
    ),
    createUserFromAuthIdentity: vi.fn(async () => currentUser)
  };
  const deleteClerkUser = vi.fn(async () => {
    if (options.clerkDeleteError) {
      throw options.clerkDeleteError;
    }
  });
  const deps: AccountRouteDeps = {
    clerkAuth,
    deleteLocalAccountData: vi.fn(async () => ({
      userDeleted: true,
      sessionRowsDeleted: 0
    })),
    deleteClerkUser
  };

  return {
    deps,
    route: createAccountRoutes(deps)
  };
}

function createD1Deps(options: { clerkDeleteError?: unknown; localCleanupError?: unknown } = {}) {
  const calls: string[] = [];
  const deleteClerkUser = vi.fn(async () => {
    calls.push("clerk");

    if (options.clerkDeleteError) {
      throw options.clerkDeleteError;
    }
  });
  const clerkAuth: ClerkAuthDeps = {
    verifyToken: vi.fn(async () => ({ sub: "user_clerk_current" })) as unknown as ClerkAuthDeps["verifyToken"],
    getClerkUser: vi.fn(async () => createClerkUser()),
    getUserByAuthIdentity,
    createUserFromAuthIdentity
  };
  const deps: AccountRouteDeps = {
    clerkAuth,
    deleteLocalAccountData: vi.fn(async (db, userId) => {
      calls.push("local");

      if (options.localCleanupError) {
        throw options.localCleanupError;
      }

      return deleteLocalAccountData(db, userId);
    }),
    deleteClerkUser
  };

  return {
    calls,
    deps,
    route: createAccountRoutes(deps)
  };
}

function authHeaders(extra: HeadersInit = {}) {
  return {
    Authorization: "Bearer clerk-session-token",
    ...extra
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("DELETE /api/account", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const { route } = createMockDeps({ authenticated: false });
    const response = await route.request("/", { method: "DELETE" }, {
      ...env,
      DB: {} as D1Database
    });

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({
      error: {
        code: "unauthenticated",
        message: "Authentication required."
      }
    });
  });

  it("deletes the current local user, current sessions, and Clerk user while preserving other data", async () => {
    const { db, dispose } = await createD1Harness();
    const { calls, deps, route } = createD1Deps();

    try {
      await seedAccountDeletionRows(db);

      const response = await route.request(
        "/",
        { method: "DELETE", headers: authHeaders() },
        { ...env, DB: db }
      );

      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({ deleted: true });
      expect(calls).toEqual(["clerk", "local"]);
      expect(await countRows(db, "users", "id = 'usr_current'")).toBe(0);
      expect(await countRows(db, "users", "id = 'usr_other'")).toBe(1);
      expect(await countRows(db, "sessions", "user_id = 'usr_current'")).toBe(0);
      expect(await countRows(db, "sessions", "user_id = 'usr_other'")).toBe(1);
      expect(await countRows(db, "companies")).toBe(1);
      expect(deps.deleteClerkUser).toHaveBeenCalledWith(
        expect.objectContaining({ CLERK_SECRET_KEY: "sk_test_mock" }),
        "user_clerk_current"
      );
    } finally {
      await dispose();
    }
  });

  it("does not accept or act on a client-supplied user ID", async () => {
    const { db, dispose } = await createD1Harness();
    const { deps, route } = createD1Deps();

    try {
      await seedAccountDeletionRows(db);

      const response = await route.request(
        "/",
        {
          method: "DELETE",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ userId: "usr_other", clerkUserId: "user_clerk_other" })
        },
        { ...env, DB: db }
      );

      expect(response.status).toBe(200);
      expect(await countRows(db, "users", "id = 'usr_current'")).toBe(0);
      expect(await countRows(db, "users", "id = 'usr_other'")).toBe(1);
      expect(deps.deleteClerkUser).toHaveBeenCalledWith(expect.anything(), "user_clerk_current");
      expect(deps.deleteClerkUser).not.toHaveBeenCalledWith(expect.anything(), "user_clerk_other");
    } finally {
      await dispose();
    }
  });

  it("clears dashboard session cookies on success", async () => {
    const { route } = createMockDeps();
    const response = await route.request(
      "/",
      {
        method: "DELETE",
        headers: authHeaders()
      },
      { ...env, DB: {} as D1Database }
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookie).toContain("__Host-rsl_dashboard_session=; Max-Age=0");
    expect(setCookie).toContain("rsl_dashboard_session=; Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("does not delete local user data or sessions when Clerk deletion fails", async () => {
    const { db, dispose } = await createD1Harness();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { calls, deps, route } = createD1Deps({
      clerkDeleteError: new Error("Clerk API unavailable with sk_test_secret")
    });

    try {
      await seedAccountDeletionRows(db);

      const response = await route.request(
        "/",
        { method: "DELETE", headers: authHeaders() },
        { ...env, DB: db }
      );
      const body = JSON.stringify(await readJson(response));
      const [logLine] = errorSpy.mock.calls.at(-1) as [string];
      const log = JSON.parse(logLine) as Record<string, unknown>;

      expect(response.status).toBe(500);
      expect(body).toContain("Your account could not be deleted.");
      expect(body).not.toContain("sk_test_secret");
      expect(calls).toEqual(["clerk"]);
      expect(deps.deleteLocalAccountData).not.toHaveBeenCalled();
      expect(await countRows(db, "users", "id = 'usr_current'")).toBe(1);
      expect(await countRows(db, "sessions", "user_id = 'usr_current'")).toBe(1);
      expect(await countRows(db, "companies")).toBe(1);
      expect(log).toMatchObject({
        event: "account_clerk_deletion_failed",
        method: "DELETE",
        path: "/",
        localUserId: "usr_current",
        clerkUserId: "user_clerk_current",
        errorName: "Error"
      });
      expect(logLine).not.toContain("sk_test_secret");
    } finally {
      errorSpy.mockRestore();
      await dispose();
    }
  });

  it("logs local cleanup failure after Clerk deletion succeeds", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { deps, route } = createMockDeps();
    vi.mocked(deps.deleteLocalAccountData).mockRejectedValueOnce(
      new Error("D1 cleanup failed with sk_test_secret")
    );
    const response = await route.request(
      "/",
      { method: "DELETE", headers: authHeaders() },
      { ...env, DB: {} as D1Database }
    );
    const body = JSON.stringify(await readJson(response));
    const [logLine] = errorSpy.mock.calls.at(-1) as [string];
    const log = JSON.parse(logLine) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body).toContain("Your account was deleted, but we could not finish cleanup.");
    expect(body).not.toContain("sk_test_secret");
    expect(deps.deleteClerkUser).toHaveBeenCalledWith(expect.anything(), "user_clerk_current");
    expect(deps.deleteLocalAccountData).toHaveBeenCalledWith(expect.anything(), "usr_current");
    expect(log).toMatchObject({
      event: "account_local_cleanup_failed",
      method: "DELETE",
      path: "/",
      localUserId: "usr_current",
      clerkUserId: "user_clerk_current",
      errorName: "Error"
    });
    expect(logLine).not.toContain("sk_test_secret");
    errorSpy.mockRestore();
  });
});

async function createD1Harness() {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: {
      DB: "test-db"
    },
    d1Persist: false
  });
  const db = await mf.getD1Database("DB");

  for (const statement of coreMigration
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)) {
    await db.prepare(statement).run();
  }

  return {
    db,
    dispose: () => mf.dispose()
  };
}

async function seedAccountDeletionRows(db: D1Database) {
  await db
    .prepare(
      `INSERT INTO companies (
        id,
        legal_name,
        primary_contact_name,
        primary_contact_email,
        country,
        created_at,
        updated_at
      ) VALUES ('cmp_current', 'Current Publishing LLC', 'Current User', 'current@example.com', 'US', ?, ?)`
    )
    .bind(timestamp, timestamp)
    .run();
  await insertUser(db, createUser());
  await insertUser(
    db,
    createUser({
      id: "usr_other",
      auth_subject: "user_clerk_other",
      company_id: null,
      email: "other@example.com"
    })
  );
  await db.prepare("CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL)").run();
  await db
    .prepare("INSERT INTO sessions (id, user_id) VALUES ('ses_current', 'usr_current')")
    .run();
  await db
    .prepare("INSERT INTO sessions (id, user_id) VALUES ('ses_other', 'usr_other')")
    .run();
}

async function insertUser(db: D1Database, user: UserRow) {
  await db
    .prepare(
      `INSERT INTO users (
        id,
        auth_provider,
        auth_subject,
        company_id,
        email,
        first_name,
        last_name,
        email_verified,
        role,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      user.id,
      user.auth_provider,
      user.auth_subject,
      user.company_id,
      user.email,
      user.first_name,
      user.last_name,
      user.email_verified,
      user.role,
      user.created_at,
      user.updated_at
    )
    .run();
}

async function countRows(db: D1Database, table: string, where?: string) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${table}${where ? ` WHERE ${where}` : ""}`)
    .first<{ count: number }>();

  return row?.count ?? 0;
}
