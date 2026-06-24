// @vitest-environment node
/// <reference types="vite/client" />

import { Miniflare } from "miniflare";

import coreMigration from "../migrations/0001_core.sql?raw";
import {
  countUsers,
  createUserFromAuthIdentity,
  createCompanyAndAttachUser,
  getUserDetailForAdmin,
  getCompanyForUser,
  getUserById,
  listUsersForAdmin,
  type AuthenticatedUserData,
  type CompanyData,
  type CompanyRow
} from "../worker/lib/db";
import { createId } from "../worker/lib/ids";
import { nowIso } from "../worker/lib/time";

type D1Harness = {
  db: D1Database;
  dispose: () => Promise<void>;
};

const timestamp = "2026-06-11T00:00:00.000Z";

const companyData: CompanyData = {
  legalName: "RSL Test Publishing LLC",
  displayName: "RSL Test",
  companyType: "Publisher",
  primaryContactName: "Ada Lovelace",
  primaryContactEmail: "ada@example.com",
  billingContactEmail: null,
  country: "US",
  region: "CA",
  city: "Los Angeles",
  postalCode: "90001",
  addressLine1: "1 Test Way",
  addressLine2: null,
  description: "A company created by the D1 atomicity test."
};

async function createD1Harness(): Promise<D1Harness> {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: {
      DB: "test-db"
    },
    d1Persist: false
  });
  const db = await mf.getD1Database("DB");

  await applyMigration(db);

  return {
    db,
    dispose: () => mf.dispose()
  };
}

async function applyMigration(db: D1Database) {
  for (const migration of [coreMigration]) {
    for (const statement of migration
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)) {
      await db.prepare(statement).run();
    }
  }
}

async function insertCompany(db: D1Database, id: string) {
  await db
    .prepare(
      `INSERT INTO companies (
        id,
        legal_name,
        display_name,
        company_type,
        primary_contact_name,
        primary_contact_email,
        billing_contact_email,
        country,
        region,
        city,
        postal_code,
        address_line1,
        address_line2,
        description,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
    )
    .bind(
      id,
      "Existing Publishing LLC",
      null,
      "Publisher",
      "Existing Owner",
      "owner@example.com",
      null,
      "US",
      null,
      null,
      null,
      null,
      null,
      null,
      timestamp,
      timestamp
    )
    .run();
}

async function insertUser(
  db: D1Database,
  id: string,
  companyId: string | null = null,
  createdAt = timestamp
) {
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
      ) VALUES (?, 'clerk', ?, ?, ?, ?, ?, 1, 'owner', ?, ?)`
    )
    .bind(
      id,
      `user_clerk_${id}`,
      companyId,
      `${id}@example.com`,
      "Test",
      "User",
      createdAt,
      createdAt
    )
    .run();
}

async function countCompanies(db: D1Database) {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM companies").first<{ count: number }>();

  return row?.count ?? 0;
}

async function countUnattachedCompanies(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
        FROM companies
        WHERE id NOT IN (
          SELECT company_id FROM users WHERE company_id IS NOT NULL
        )`
    )
    .first<{ count: number }>();

  return row?.count ?? 0;
}

function getCompanyById(db: D1Database, companyId: string) {
  return db.prepare("SELECT * FROM companies WHERE id = ?").bind(companyId).first<CompanyRow>();
}

describe("database helper utilities", () => {
  it("generates prefixed opaque IDs", () => {
    const userId = createId("usr");
    const companyId = createId("cmp");

    expect(userId).toMatch(/^usr_[0-9a-f]{32}$/);
    expect(companyId).toMatch(/^cmp_[0-9a-f]{32}$/);
    expect(new Set([userId, companyId]).size).toBe(2);
  });

  it("formats timestamps as ISO strings", () => {
    const base = new Date("2026-06-11T00:00:00.000Z");

    expect(nowIso(base)).toBe("2026-06-11T00:00:00.000Z");
  });

  it("does not create a local sessions table", async () => {
    const { db, dispose } = await createD1Harness();

    try {
      const columns = await db
        .prepare("PRAGMA table_info(sessions)")
        .all<{ name: string }>();

      expect(columns.results).toEqual([]);
    } finally {
      await dispose();
    }
  });
});

describe("createUserFromAuthIdentity D1 idempotency", () => {
  it("recovers cleanly when parallel first-login requests provision the same Clerk user", async () => {
    const { db, dispose } = await createD1Harness();
    const userData: AuthenticatedUserData = {
      authProvider: "clerk",
      authSubject: "user_clerk_parallel",
      email: "parallel@example.com",
      firstName: "Parallel",
      lastName: "Publisher",
      emailVerified: true
    };

    try {
      const [first, second] = await Promise.all([
        createUserFromAuthIdentity(db, userData, { id: "usr_parallel_a", timestamp }),
        createUserFromAuthIdentity(db, userData, { id: "usr_parallel_b", timestamp })
      ]);
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count
            FROM users
            WHERE auth_provider = 'clerk'
              AND auth_subject = 'user_clerk_parallel'`
        )
        .first<{ count: number }>();

      expect(first?.auth_subject).toBe("user_clerk_parallel");
      expect(second?.auth_subject).toBe("user_clerk_parallel");
      expect(first?.id).toBe(second?.id);
      expect(row?.count).toBe(1);
    } finally {
      await dispose();
    }
  });
});

describe("admin user D1 helpers", () => {
  it("counts and lists users newest first with company legal names", async () => {
    const { db, dispose } = await createD1Harness();

    try {
      await insertCompany(db, "cmp_existing");
      await insertUser(db, "usr_oldest", null, "2026-06-10T00:00:00.000Z");
      await insertUser(db, "usr_newest", "cmp_existing", "2026-06-12T00:00:00.000Z");
      await insertUser(db, "usr_middle", null, "2026-06-11T00:00:00.000Z");

      const total = await countUsers(db);
      const firstPage = await listUsersForAdmin(db, 2, 0);

      expect(total).toBe(3);
      expect(firstPage.results.map((user) => user.id)).toEqual(["usr_newest", "usr_middle"]);
      expect(firstPage.results[0]).toMatchObject({
        company_id: "cmp_existing",
        company_legal_name: "Existing Publishing LLC"
      });
    } finally {
      await dispose();
    }
  });

  it("fetches admin user detail with a joined company summary", async () => {
    const { db, dispose } = await createD1Harness();

    try {
      await insertCompany(db, "cmp_existing");
      await insertUser(db, "usr_detail", "cmp_existing");

      const detail = await getUserDetailForAdmin(db, "usr_detail");

      expect(detail).toMatchObject({
        id: "usr_detail",
        auth_provider: "clerk",
        email: "usr_detail@example.com",
        company_id: "cmp_existing",
        company_legal_name: "Existing Publishing LLC",
        company_status: "draft"
      });
      expect(detail).not.toHaveProperty("authSubject");
    } finally {
      await dispose();
    }
  });
});

describe("createCompanyAndAttachUser D1 atomicity", () => {
  it("creates and attaches a company for an eligible user", async () => {
    const { db, dispose } = await createD1Harness();

    try {
      await insertUser(db, "usr_eligible");

      const company = await createCompanyAndAttachUser(db, "usr_eligible", companyData, {
        id: "cmp_created",
        timestamp
      });
      const user = await getUserById(db, "usr_eligible");
      const attachedCompany = await getCompanyForUser(db, "usr_eligible");

      expect(company.id).toBe("cmp_created");
      expect(user?.company_id).toBe("cmp_created");
      expect(attachedCompany?.id).toBe("cmp_created");
      expect(await countCompanies(db)).toBe(1);
      expect(await countUnattachedCompanies(db)).toBe(0);
    } finally {
      await dispose();
    }
  });

  it("does not leave a new company when the user already has a company", async () => {
    const { db, dispose } = await createD1Harness();

    try {
      await insertCompany(db, "cmp_existing");
      await insertUser(db, "usr_ineligible", "cmp_existing");

      await expect(
        createCompanyAndAttachUser(db, "usr_ineligible", companyData, {
          id: "cmp_rejected",
          timestamp
        })
      ).rejects.toThrow("Company creation failed");

      const user = await getUserById(db, "usr_ineligible");

      expect(user?.company_id).toBe("cmp_existing");
      expect(await getCompanyById(db, "cmp_rejected")).toBeNull();
      expect(await countCompanies(db)).toBe(1);
      expect(await countUnattachedCompanies(db)).toBe(0);
    } finally {
      await dispose();
    }
  });

  it("does not leave a company when the user is missing", async () => {
    const { db, dispose } = await createD1Harness();

    try {
      await expect(
        createCompanyAndAttachUser(db, "usr_missing", companyData, {
          id: "cmp_missing_user",
          timestamp
        })
      ).rejects.toThrow("Company creation failed");

      expect(await getCompanyById(db, "cmp_missing_user")).toBeNull();
      expect(await countCompanies(db)).toBe(0);
      expect(await countUnattachedCompanies(db)).toBe(0);
    } finally {
      await dispose();
    }
  });
});
