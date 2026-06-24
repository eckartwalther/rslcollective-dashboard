import { Hono, type Context } from "hono";
import { isAdminUser, type AdminEnv } from "../lib/admin";
import {
  countUsers as countUsersInDb,
  getUserDetailForAdmin as getUserDetailForAdminInDb,
  listUsersForAdmin as listUsersForAdminInDb,
  type AdminUserDetailRow,
  type AdminUserListRow
} from "../lib/db";
import {
  authenticateClerkRequest,
  defaultClerkAuthDeps,
  type ClerkAuthDeps,
  type ClerkEnv
} from "../lib/clerk";
import { forbidden, notFound, unauthenticated } from "../lib/responses";

type Bindings = ClerkEnv &
  AdminEnv & {
    DB: D1Database;
  };

export type AdminRouteDeps = {
  clerkAuth: ClerkAuthDeps;
  listUsers: (db: D1Database, limit: number, offset: number) => Promise<D1Result<AdminUserListRow>>;
  countUsers: (db: D1Database) => Promise<number>;
  getUserDetail: (db: D1Database, userId: string) => Promise<AdminUserDetailRow | null>;
};

const defaultDeps: AdminRouteDeps = {
  clerkAuth: defaultClerkAuthDeps,
  listUsers: listUsersForAdminInDb,
  countUsers: countUsersInDb,
  getUserDetail: getUserDetailForAdminInDb
};

const defaultPage = 1;
const defaultPageSize = 25;
const maxPageSize = 100;

export function createAdminRoutes(deps: AdminRouteDeps = defaultDeps) {
  const routes = new Hono<{ Bindings: Bindings }>();

  routes.get("/users", async (c) => {
    const auth = await authenticateAdminRequest(c, deps);

    if (auth instanceof Response) {
      return auth;
    }

    const { page, pageSize } = parsePagination(c.req.url);
    const total = await deps.countUsers(c.env.DB);
    const result = await deps.listUsers(c.env.DB, pageSize, (page - 1) * pageSize);

    return c.json({
      users: result.results.map(mapAdminUserListRow),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    });
  });

  routes.get("/users/:id", async (c) => {
    const auth = await authenticateAdminRequest(c, deps);

    if (auth instanceof Response) {
      return auth;
    }

    const user = await deps.getUserDetail(c.env.DB, c.req.param("id"));

    if (!user) {
      return notFound(c, "User not found.");
    }

    return c.json({
      user: mapAdminUserDetailRow(user)
    });
  });

  return routes;
}

export const adminRoutes = createAdminRoutes();

async function authenticateAdminRequest(
  c: Context<{ Bindings: Bindings }>,
  deps: AdminRouteDeps
) {
  const auth = await authenticateClerkRequest(
    c.env.DB,
    c.req.raw,
    c.env,
    deps.clerkAuth
  );

  if (!auth) {
    return unauthenticated(c);
  }

  if (!isAdminUser(auth.user, c.env)) {
    return forbidden(c, "Admin access required.");
  }

  return auth;
}

function parsePagination(url: string) {
  const searchParams = new URL(url).searchParams;
  const page = parsePositiveInteger(searchParams.get("page"), defaultPage);
  const requestedPageSize = parsePositiveInteger(searchParams.get("pageSize"), defaultPageSize);

  return {
    page,
    pageSize: Math.min(requestedPageSize, maxPageSize)
  };
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function mapAdminUserListRow(user: AdminUserListRow) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    authProvider: user.auth_provider,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    companyId: user.company_id,
    companyLegalName: user.company_legal_name
  };
}

function mapAdminUserDetailRow(user: AdminUserDetailRow) {
  return {
    ...mapAdminUserListRow(user),
    emailVerified: user.email_verified === 1,
    role: user.role,
    company: user.company_id
      ? {
          id: user.company_id,
          legalName: user.company_legal_name,
          displayName: user.company_display_name,
          companyType: user.company_type,
          primaryContactName: user.company_primary_contact_name,
          primaryContactEmail: user.company_primary_contact_email,
          billingContactEmail: user.company_billing_contact_email,
          country: user.company_country,
          region: user.company_region,
          city: user.company_city,
          postalCode: user.company_postal_code,
          addressLine1: user.company_address_line1,
          addressLine2: user.company_address_line2,
          description: user.company_description,
          status: user.company_status,
          createdAt: user.company_created_at,
          updatedAt: user.company_updated_at
        }
      : null
  };
}
