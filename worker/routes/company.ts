import { Hono, type Context } from "hono";
import { ZodError } from "zod";
import { companyProfileSchema, type CompanyProfile } from "../../src/schemas/company";
import { requireValidOrigin, type OriginEnv } from "../lib/csrf";
import {
  createCompanyAndAttachUser as createCompanyAndAttachUserInDb,
  getCompanyForUser as getCompanyForUserInDb,
  getUserById as getUserByIdInDb,
  updateCompanyForUser as updateCompanyForUserInDb,
  type CompanyData,
  type CompanyRow,
  type UserRow
} from "../lib/db";
import {
  conflict,
  unauthenticated,
  validationError
} from "../lib/responses";
import {
  createD1SessionStore,
  validateSessionFromRequest,
  type SessionEnv,
  type SessionStore
} from "../lib/session";

type Bindings = OriginEnv &
  SessionEnv & {
    DB: D1Database;
  };

export type CompanyRouteDeps = {
  createSessionStore: (db: D1Database) => SessionStore;
  getUserById: (db: D1Database, userId: string) => Promise<UserRow | null>;
  getCompanyForUser: (db: D1Database, userId: string) => Promise<CompanyRow | null>;
  createCompanyAndAttachUser: (
    db: D1Database,
    userId: string,
    company: CompanyData
  ) => Promise<CompanyRow>;
  updateCompanyForUser: (
    db: D1Database,
    userId: string,
    company: CompanyData
  ) => Promise<CompanyRow | null>;
};

const defaultDeps: CompanyRouteDeps = {
  createSessionStore: createD1SessionStore,
  getUserById: getUserByIdInDb,
  getCompanyForUser: getCompanyForUserInDb,
  createCompanyAndAttachUser: createCompanyAndAttachUserInDb,
  updateCompanyForUser: updateCompanyForUserInDb
};

export function createCompanyRoutes(deps: CompanyRouteDeps = defaultDeps) {
  const routes = new Hono<{ Bindings: Bindings }>();

  routes.get("/", async (c) => {
    const auth = await authenticateCompanyRequest(c, deps);

    if (!auth) {
      return unauthenticated(c);
    }

    const company = await deps.getCompanyForUser(c.env.DB, auth.user.id);

    return c.json({
      company: company ? mapCompanyRow(company) : null
    });
  });

  routes.put("/", async (c) => {
    const auth = await authenticateCompanyRequest(c, deps);

    if (!auth) {
      return unauthenticated(c);
    }

    const originError = requireValidOrigin(c);

    if (originError) {
      return originError;
    }

    let payload: CompanyProfile;

    try {
      payload = companyProfileSchema.parse(await c.req.json());
    } catch (error) {
      if (error instanceof ZodError) {
        return validationError(c, "Invalid company profile.", zodFields(error));
      }

      return validationError(c, "Invalid company profile.");
    }

    try {
      const company = auth.user.company_id
        ? await deps.updateCompanyForUser(c.env.DB, auth.user.id, payload)
        : await deps.createCompanyAndAttachUser(c.env.DB, auth.user.id, payload);

      if (!company) {
        return conflict(c, "Company profile could not be saved.");
      }

      return c.json(
        {
          company: mapCompanyRow(company)
        },
        auth.user.company_id ? 200 : 201
      );
    } catch {
      return conflict(c, "Company profile could not be saved.");
    }
  });

  return routes;
}

export const companyRoutes = createCompanyRoutes();

async function authenticateCompanyRequest(
  c: Context<{ Bindings: Bindings }>,
  deps: CompanyRouteDeps
) {
  const store = deps.createSessionStore(c.env.DB);
  const session = await validateSessionFromRequest(store, c.req.raw, c.env);

  if (!session.authenticated) {
    return null;
  }

  c.header("Set-Cookie", session.cookie);

  const user = await deps.getUserById(c.env.DB, session.session.user_id);

  if (!user) {
    return null;
  }

  return {
    session,
    user
  };
}

function mapCompanyRow(company: CompanyRow) {
  return {
    legalName: company.legal_name,
    displayName: company.display_name,
    companyType: company.company_type,
    primaryContactName: company.primary_contact_name,
    primaryContactEmail: company.primary_contact_email,
    billingContactEmail: company.billing_contact_email,
    country: company.country,
    region: company.region,
    city: company.city,
    postalCode: company.postal_code,
    addressLine1: company.address_line1,
    addressLine2: company.address_line2,
    description: company.description,
    status: company.status,
    createdAt: company.created_at,
    updatedAt: company.updated_at
  };
}

function zodFields(error: ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    fields[path || "payload"] = issue.message;
  }

  return fields;
}
