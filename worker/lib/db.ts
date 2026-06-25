import { createId } from "./ids";
import { nowIso } from "./time";

export type UserRow = {
  id: string;
  auth_provider: string;
  auth_subject: string;
  company_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  email_verified: number;
  role: string;
  created_at: string;
  updated_at: string;
};

export type CompanyRow = {
  id: string;
  legal_name: string;
  display_name: string | null;
  company_type: string | null;
  primary_contact_name: string;
  primary_contact_email: string;
  billing_contact_email: string | null;
  country: string;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AdminUserListRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  auth_provider: string;
  created_at: string;
  updated_at: string;
  company_id: string | null;
  company_legal_name: string | null;
};

export type AdminUserDetailRow = AdminUserListRow & {
  email_verified: number;
  role: string;
  company_display_name: string | null;
  company_type: string | null;
  company_primary_contact_name: string | null;
  company_primary_contact_email: string | null;
  company_billing_contact_email: string | null;
  company_country: string | null;
  company_region: string | null;
  company_city: string | null;
  company_postal_code: string | null;
  company_address_line1: string | null;
  company_address_line2: string | null;
  company_description: string | null;
  company_status: string | null;
  company_created_at: string | null;
  company_updated_at: string | null;
};

export type AuthenticatedUserData = {
  authProvider: string;
  authSubject: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
};

export type CompanyData = {
  legalName: string;
  displayName?: string | null;
  companyType?: string | null;
  primaryContactName: string;
  primaryContactEmail: string;
  billingContactEmail?: string | null;
  country: string;
  region?: string | null;
  city?: string | null;
  postalCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  description?: string | null;
};

type CreateOptions = {
  id?: string;
  timestamp?: string;
};

export class CompanyConflictError extends Error {
  constructor(message = "Company creation failed or user already has a company.") {
    super(message);
    this.name = "CompanyConflictError";
  }
}

function nullable(value: string | null | undefined) {
  return value ?? null;
}

function emailVerifiedValue(value: boolean | undefined) {
  return value ? 1 : 0;
}

export function getUserByAuthIdentity(
  db: D1Database,
  authProvider: string,
  authSubject: string
) {
  return db
    .prepare("SELECT * FROM users WHERE auth_provider = ? AND auth_subject = ?")
    .bind(authProvider, authSubject)
    .first<UserRow>();
}

export async function createUserFromAuthIdentity(
  db: D1Database,
  user: AuthenticatedUserData,
  options: CreateOptions = {}
) {
  const id = options.id ?? createId("usr");
  const timestamp = options.timestamp ?? nowIso();

  await db
    .prepare(
      `INSERT INTO users (
        id,
        auth_provider,
        auth_subject,
        email,
        first_name,
        last_name,
        email_verified,
        role,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'owner', ?, ?)
      ON CONFLICT(auth_provider, auth_subject) DO NOTHING`
    )
    .bind(
      id,
      user.authProvider,
      user.authSubject,
      user.email,
      nullable(user.firstName),
      nullable(user.lastName),
      emailVerifiedValue(user.emailVerified),
      timestamp,
      timestamp
    )
    .run();

  return getUserByAuthIdentity(db, user.authProvider, user.authSubject);
}

export function getUserById(db: D1Database, userId: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
}

export function listUsersForAdmin(db: D1Database, limit: number, offset: number) {
  return db
    .prepare(
      `SELECT
        users.id,
        users.email,
        users.first_name,
        users.last_name,
        users.auth_provider,
        users.created_at,
        users.updated_at,
        users.company_id,
        companies.legal_name AS company_legal_name
      FROM users
      LEFT JOIN companies ON companies.id = users.company_id
      ORDER BY users.created_at DESC, users.id DESC
      LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<AdminUserListRow>();
}

export async function countUsers(db: D1Database) {
  const row = await db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();

  return row?.total ?? 0;
}

export function getUserDetailForAdmin(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT
        users.id,
        users.email,
        users.first_name,
        users.last_name,
        users.auth_provider,
        users.email_verified,
        users.role,
        users.created_at,
        users.updated_at,
        users.company_id,
        companies.legal_name AS company_legal_name,
        companies.display_name AS company_display_name,
        companies.company_type AS company_type,
        companies.primary_contact_name AS company_primary_contact_name,
        companies.primary_contact_email AS company_primary_contact_email,
        companies.billing_contact_email AS company_billing_contact_email,
        companies.country AS company_country,
        companies.region AS company_region,
        companies.city AS company_city,
        companies.postal_code AS company_postal_code,
        companies.address_line1 AS company_address_line1,
        companies.address_line2 AS company_address_line2,
        companies.description AS company_description,
        companies.status AS company_status,
        companies.created_at AS company_created_at,
        companies.updated_at AS company_updated_at
      FROM users
      LEFT JOIN companies ON companies.id = users.company_id
      WHERE users.id = ?`
    )
    .bind(userId)
    .first<AdminUserDetailRow>();
}

export async function getCompanyForUser(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT companies.*
        FROM companies
        INNER JOIN users ON users.company_id = companies.id
        WHERE users.id = ?`
    )
    .bind(userId)
    .first<CompanyRow>();
}

export async function createCompanyAndAttachUser(
  db: D1Database,
  userId: string,
  company: CompanyData,
  options: CreateOptions = {}
) {
  const user = await getUserById(db, userId);

  if (!user || user.company_id !== null) {
    throw new CompanyConflictError();
  }

  const companyId = options.id ?? createId("cmp");
  const timestamp = options.timestamp ?? nowIso();

  const insertCompany = db
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
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?
      WHERE EXISTS (
        SELECT 1 FROM users WHERE id = ? AND company_id IS NULL
      )`
    )
    .bind(
      companyId,
      company.legalName,
      nullable(company.displayName),
      nullable(company.companyType),
      company.primaryContactName,
      company.primaryContactEmail,
      nullable(company.billingContactEmail),
      company.country,
      nullable(company.region),
      nullable(company.city),
      nullable(company.postalCode),
      nullable(company.addressLine1),
      nullable(company.addressLine2),
      nullable(company.description),
      timestamp,
      timestamp,
      userId
    );

  const attachUser = db
    .prepare(
      `UPDATE users
        SET company_id = ?,
            role = 'owner',
            updated_at = ?
        WHERE id = ?
          AND company_id IS NULL
          AND EXISTS (SELECT 1 FROM companies WHERE id = ?)`
    )
    .bind(companyId, timestamp, userId, companyId);

  const removeUnattachedCompany = db
    .prepare(
      `DELETE FROM companies
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1 FROM users WHERE company_id = ?
          )`
    )
    .bind(companyId, companyId);

  const [, attachResult, cleanupResult] = await db.batch([
    insertCompany,
    attachUser,
    removeUnattachedCompany
  ]);

  if (attachResult.meta.changes !== 1 || cleanupResult.meta.changes !== 0) {
    throw new CompanyConflictError();
  }

  const attachedCompany = await getCompanyForUser(db, userId);

  if (!attachedCompany || attachedCompany.id !== companyId) {
    throw new CompanyConflictError();
  }

  return attachedCompany;
}

export async function updateCompanyForUser(
  db: D1Database,
  userId: string,
  company: CompanyData
) {
  await db
    .prepare(
      `UPDATE companies
        SET legal_name = ?,
            display_name = ?,
            company_type = ?,
            primary_contact_name = ?,
            primary_contact_email = ?,
            billing_contact_email = ?,
            country = ?,
            region = ?,
            city = ?,
            postal_code = ?,
            address_line1 = ?,
            address_line2 = ?,
            description = ?,
            updated_at = ?
        WHERE id = (
          SELECT company_id FROM users WHERE id = ? AND company_id IS NOT NULL
        )`
    )
    .bind(
      company.legalName,
      nullable(company.displayName),
      nullable(company.companyType),
      company.primaryContactName,
      company.primaryContactEmail,
      nullable(company.billingContactEmail),
      company.country,
      nullable(company.region),
      nullable(company.city),
      nullable(company.postalCode),
      nullable(company.addressLine1),
      nullable(company.addressLine2),
      nullable(company.description),
      nowIso(),
      userId
    )
    .run();

  return getCompanyForUser(db, userId);
}

export type DeleteLocalAccountDataResult = {
  userDeleted: boolean;
  sessionRowsDeleted: number;
};

export async function deleteLocalAccountData(
  db: D1Database,
  userId: string
): Promise<DeleteLocalAccountDataResult> {
  const statements: D1PreparedStatement[] = [];
  const sessionsUserIdColumn = await getSessionsUserIdColumn(db);

  if (sessionsUserIdColumn) {
    statements.push(
      db.prepare(`DELETE FROM sessions WHERE ${sessionsUserIdColumn} = ?`).bind(userId)
    );
  }

  statements.push(db.prepare("DELETE FROM users WHERE id = ?").bind(userId));

  const results = await db.batch(statements);
  const userResult = results.at(-1);
  const sessionsResult = sessionsUserIdColumn ? results[0] : null;

  return {
    userDeleted: (userResult?.meta.changes ?? 0) === 1,
    sessionRowsDeleted: sessionsResult?.meta.changes ?? 0
  };
}

async function getSessionsUserIdColumn(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(sessions)")
    .all<{ name: string }>();
  const columnNames = new Set(columns.results.map((column) => column.name));

  if (columnNames.has("user_id")) {
    return "user_id";
  }

  if (columnNames.has("userId")) {
    return "userId";
  }

  return null;
}
