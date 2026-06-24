// @vitest-environment node
/// <reference types="vite/client" />

import { Miniflare } from "miniflare";

import coreMigration from "../migrations/0001_core.sql?raw";
import {
  CLERK_PROVIDER,
  authenticateClerkRequest,
  getClerkSessionToken,
  mapClerkUser,
  type ClerkAuthDeps
} from "../worker/lib/clerk";
import {
  createUserFromAuthIdentity,
  getUserByAuthIdentity,
  type AuthenticatedUserData,
  type UserRow
} from "../worker/lib/db";

const env = {
  CLERK_AUTHORIZED_PARTIES: "https://dashboard.rslcollective.org,http://localhost:8787",
  CLERK_SECRET_KEY: "sk_test_mock",
  DB: {} as D1Database
};

function createUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "usr_test",
    auth_provider: "clerk",
    auth_subject: "user_clerk_test",
    company_id: null,
    email: "publisher@example.com",
    first_name: "Jane",
    last_name: "Publisher",
    email_verified: 1,
    role: "owner",
    created_at: "2026-06-11T00:00:00.000Z",
    updated_at: "2026-06-11T00:00:00.000Z",
    ...overrides
  };
}

function createDeps(options: { existingUser?: UserRow | null } = {}) {
  const calls = {
    createdUser: null as AuthenticatedUserData | null
  };
  const deps: ClerkAuthDeps = {
    verifyToken: vi.fn(async () => ({ sub: "user_clerk_test" })) as unknown as ClerkAuthDeps["verifyToken"],
    getClerkUser: vi.fn(async () => ({
      id: "user_clerk_test",
      firstName: "Jane",
      lastName: "Publisher",
      primaryEmailAddressId: "idn_email",
      emailAddresses: [
        {
          id: "idn_email",
          emailAddress: "publisher@example.com",
          verification: { status: "verified" }
        }
      ]
    })),
    getUserByAuthIdentity: vi.fn(async () => options.existingUser ?? null),
    createUserFromAuthIdentity: vi.fn(async (_db, data) => {
      calls.createdUser = data;
      return createUser();
    })
  };

  return { calls, deps };
}

describe("Clerk auth helper", () => {
  it("extracts Clerk session tokens from Authorization only", () => {
    const cookieName = ["__", "session"].join("");

    expect(
      getClerkSessionToken(
        new Request("https://dashboard.rslcollective.org/api/session", {
          headers: { Authorization: "Bearer auth-header-token" }
        })
      )
    ).toBe("auth-header-token");
    expect(
      getClerkSessionToken(
        new Request("https://dashboard.rslcollective.org/api/session", {
          headers: { Cookie: `other=value; ${cookieName}=cookie-token` }
        })
      )
    ).toBeNull();
  });

  it("verifies tokens with authorized parties and Clerk secret key", async () => {
    const { deps } = createDeps({ existingUser: createUser() });

    await authenticateClerkRequest(
      env.DB,
      new Request("https://dashboard.rslcollective.org/api/session", {
        headers: { Authorization: "Bearer clerk-session-token" }
      }),
      env,
      deps
    );

    expect(deps.verifyToken).toHaveBeenCalledWith("clerk-session-token", {
      secretKey: "sk_test_mock",
      authorizedParties: ["https://dashboard.rslcollective.org", "http://localhost:8787"]
    });
  });

  it("maps Clerk user identity to provider-neutral D1 identity", () => {
    expect(
      mapClerkUser({
        id: "user_clerk_test",
        firstName: "Jane",
        lastName: "Publisher",
        primaryEmailAddressId: "idn_email",
        emailAddresses: [
          {
            id: "idn_email",
            emailAddress: "publisher@example.com",
            verification: { status: "verified" }
          }
        ]
      })
    ).toEqual({
      authProvider: CLERK_PROVIDER,
      authSubject: "user_clerk_test",
      email: "publisher@example.com",
      firstName: "Jane",
      lastName: "Publisher",
      emailVerified: true
    });
  });

  it("creates a local user keyed by Clerk user id, not email", async () => {
    const { calls, deps } = createDeps();

    const result = await authenticateClerkRequest(
      env.DB,
      new Request("https://dashboard.rslcollective.org/api/company", {
        headers: { Authorization: "Bearer clerk-session-token" }
      }),
      env,
      deps
    );

    expect(result?.user.id).toBe("usr_test");
    expect(calls.createdUser).toMatchObject({
      authProvider: "clerk",
      authSubject: "user_clerk_test",
      email: "publisher@example.com"
    });
    expect(calls.createdUser?.authSubject).not.toBe(calls.createdUser?.email);
  });

  it("returns null for invalid Clerk tokens", async () => {
    const { deps } = createDeps();
    vi.mocked(deps.verifyToken).mockRejectedValueOnce(new Error("invalid"));

    await expect(
      authenticateClerkRequest(
        env.DB,
        new Request("https://dashboard.rslcollective.org/api/company", {
          headers: { Authorization: "Bearer bad-token" }
        }),
        env,
        deps
      )
    ).resolves.toBeNull();
  });

  it("recovers cleanly when parallel first-login requests provision the same Clerk user", async () => {
    const { db, dispose } = await createD1Harness();
    const deps: ClerkAuthDeps = {
      verifyToken: vi.fn(async () => ({ sub: "user_clerk_parallel" })) as unknown as ClerkAuthDeps["verifyToken"],
      getClerkUser: vi.fn(async () => ({
        id: "user_clerk_parallel",
        firstName: "Pat",
        lastName: "Publisher",
        primaryEmailAddressId: "idn_parallel",
        emailAddresses: [
          {
            id: "idn_parallel",
            emailAddress: "parallel@example.com",
            verification: { status: "verified" }
          }
        ]
      })),
      getUserByAuthIdentity,
      createUserFromAuthIdentity
    };
    const request = new Request("https://dashboard.rslcollective.org/api/session", {
      headers: { Authorization: "Bearer clerk-session-token" }
    });

    try {
      const [first, second] = await Promise.all([
        authenticateClerkRequest(db, request, env, deps),
        authenticateClerkRequest(db, request, env, deps)
      ]);
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count
            FROM users
            WHERE auth_provider = 'clerk'
              AND auth_subject = 'user_clerk_parallel'`
        )
        .first<{ count: number }>();

      expect(first?.user.auth_subject).toBe("user_clerk_parallel");
      expect(second?.user.auth_subject).toBe("user_clerk_parallel");
      expect(first?.user.id).toBe(second?.user.id);
      expect(row?.count).toBe(1);
    } finally {
      await dispose();
    }
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
