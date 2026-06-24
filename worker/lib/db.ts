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
