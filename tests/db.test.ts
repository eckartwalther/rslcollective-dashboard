// @vitest-environment node
/// <reference types="vite/client" />

import { Miniflare } from "miniflare";

import migration from "../migrations/0001_core.sql?raw";
import {
  createCompanyAndAttachUser,
  getCompanyForUser,
  getUserById,
  type CompanyData,
  type CompanyRow
} from "../worker/lib/db";
import { createId } from "../worker/lib/ids";
import { addDaysIso, nowIso } from "../worker/lib/time";

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
  for (const statement of migration
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)) {
    await db.prepare(statement).run();
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

async function insertUser(db: D1Database, id: string, companyId: string | null = null) {
  await db
    .prepare(
      `INSERT INTO users (
        id,
        workos_user_id,
        company_id,
        email,
        first_name,
        last_name,
        email_verified,
        role,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 'owner', ?, ?)`
    )
    .bind(
      id,
      `workos_${id}`,
      companyId,
      `${id}@example.com`,
      "Test",
      "User",
      timestamp,
      timestamp
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
    const sessionId = createId("ses");

    expect(userId).toMatch(/^usr_[0-9a-f]{32}$/);
    expect(companyId).toMatch(/^cmp_[0-9a-f]{32}$/);
    expect(sessionId).toMatch(/^ses_[0-9a-f]{32}$/);
    expect(new Set([userId, companyId, sessionId]).size).toBe(3);
  });

  it("formats timestamps as ISO strings and adds days deterministically", () => {
    const base = new Date("2026-06-11T00:00:00.000Z");

    expect(nowIso(base)).toBe("2026-06-11T00:00:00.000Z");
    expect(addDaysIso(30, base)).toBe("2026-07-11T00:00:00.000Z");
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
