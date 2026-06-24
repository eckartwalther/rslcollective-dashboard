import { Hono, type Context } from "hono";
import { ZodError } from "zod";
import { companyProfileSchema, type CompanyProfile } from "../../src/schemas/company";
import { requireValidOrigin, type OriginEnv } from "../lib/csrf";
import {
  createCompanyAndAttachUser as createCompanyAndAttachUserInDb,
  CompanyConflictError,
  getCompanyForUser as getCompanyForUserInDb,
  updateCompanyForUser as updateCompanyForUserInDb,
  type CompanyData,
  type CompanyRow,
  type UserRow
} from "../lib/db";
import {
  conflict,
  serverError,
  unauthenticated,
  validationError
} from "../lib/responses";
import {
  authenticateClerkRequest,
  defaultClerkAuthDeps,
  type ClerkAuthDeps,
  type ClerkEnv
} from "../lib/clerk";

type Bindings = OriginEnv &
  ClerkEnv & {
    DB: D1Database;
  };

export type CompanyRouteDeps = {
  clerkAuth: ClerkAuthDeps;
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
  clerkAuth: defaultClerkAuthDeps,
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
    } catch (error) {
      if (error instanceof CompanyConflictError) {
        return conflict(c, "Company profile could not be saved.");
      }

      logCompanySaveError(c, error);
      return serverError(c, "Company profile could not be saved.");
    }
  });

  return routes;
}

export const companyRoutes = createCompanyRoutes();

async function authenticateCompanyRequest(
  c: Context<{ Bindings: Bindings }>,
  deps: CompanyRouteDeps
) {
  const auth = await authenticateClerkRequest(
    c.env.DB,
    c.req.raw,
    c.env,
    deps.clerkAuth
  );

  if (!auth) {
    return null;
  }

  return {
    user: auth.user
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

function logCompanySaveError(c: Context<{ Bindings: Bindings }>, error: unknown) {
  console.error(
    JSON.stringify({
      event: "company_save_failed",
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      errorName: error instanceof Error ? error.name : typeof error
    })
  );
}
