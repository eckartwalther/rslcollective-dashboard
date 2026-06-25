import { createClerkClient, verifyToken as verifyClerkToken } from "@clerk/backend";
import {
  createUserFromAuthIdentity,
  getUserByAuthIdentity,
  type AuthenticatedUserData,
  type UserRow
} from "./db";

export const CLERK_PROVIDER = "clerk";

export type ClerkEnv = {
  CLERK_AUTHORIZED_PARTIES?: string;
  CLERK_SECRET_KEY?: string;
  DASHBOARD_BASE_URL?: string;
  ENVIRONMENT?: string;
};

export type ClerkTokenClaims = {
  sub?: string;
  [claim: string]: unknown;
};

export type ClerkEmailAddress = {
  id?: string | null;
  emailAddress?: string | null;
  verification?: {
    status?: string | null;
  } | null;
};

export type ClerkBackendUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddressId?: string | null;
  primaryEmailAddress?: ClerkEmailAddress | null;
  emailAddresses?: ClerkEmailAddress[];
};

export type AuthenticatedClerkRequest = {
  clerkUserId: string;
  tokenClaims: ClerkTokenClaims;
  user: UserRow;
};

export type ClerkAuthDeps = {
  verifyToken: typeof verifyClerkToken;
  getClerkUser: (env: ClerkEnv, userId: string) => Promise<ClerkBackendUser>;
  getUserByAuthIdentity: (
    db: D1Database,
    authProvider: string,
    authSubject: string
  ) => Promise<UserRow | null>;
  createUserFromAuthIdentity: (
    db: D1Database,
    user: AuthenticatedUserData
  ) => Promise<UserRow | null>;
};

export const defaultClerkAuthDeps: ClerkAuthDeps = {
  verifyToken: verifyClerkToken,
  getClerkUser: async (env, userId) => {
    if (!env.CLERK_SECRET_KEY) {
      throw new Error("Clerk is not configured.");
    }

    const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    return client.users.getUser(userId) as Promise<ClerkBackendUser>;
  },
  getUserByAuthIdentity,
  createUserFromAuthIdentity
};

export async function deleteClerkUser(env: ClerkEnv, userId: string) {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error("Clerk is not configured.");
  }

  const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  await client.users.deleteUser(userId);
}

export async function authenticateClerkRequest(
  db: D1Database,
  request: Request,
  env: ClerkEnv,
  deps: ClerkAuthDeps = defaultClerkAuthDeps
): Promise<AuthenticatedClerkRequest | null> {
  const token = getClerkSessionToken(request);

  if (!token) {
    return null;
  }

  let tokenClaims: ClerkTokenClaims;

  try {
    tokenClaims = await verifyRequestToken(token, env, deps);
  } catch {
    return null;
  }
  const clerkUserId = tokenClaims.sub;

  if (!clerkUserId) {
    return null;
  }

  const existingUser = await deps.getUserByAuthIdentity(db, CLERK_PROVIDER, clerkUserId);

  if (existingUser) {
    return {
      clerkUserId,
      tokenClaims,
      user: existingUser
    };
  }

  let user: UserRow | null;

  try {
    const clerkUser = await deps.getClerkUser(env, clerkUserId);
    const userData = mapClerkUser(clerkUser);
    user = await deps.createUserFromAuthIdentity(db, userData);
  } catch {
    return null;
  }

  if (!user) {
    return null;
  }

  return {
    clerkUserId,
    tokenClaims,
    user
  };
}

export function getClerkSessionToken(request: Request) {
  const authorization = request.headers.get("Authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim() || null;
  }

  return null;
}

export function mapClerkUser(user: ClerkBackendUser): AuthenticatedUserData {
  const primaryEmail = getPrimaryEmailAddress(user);

  if (!primaryEmail?.emailAddress) {
    throw new Error("Clerk user did not include a primary email address.");
  }

  return {
    authProvider: CLERK_PROVIDER,
    authSubject: user.id,
    email: primaryEmail.emailAddress,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    emailVerified: primaryEmail.verification?.status === "verified"
  };
}

async function verifyRequestToken(
  token: string,
  env: ClerkEnv,
  deps: ClerkAuthDeps
): Promise<ClerkTokenClaims> {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error("Clerk is not configured.");
  }

  return deps.verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY,
    authorizedParties: getAuthorizedParties(env)
  }) as Promise<ClerkTokenClaims>;
}

function getAuthorizedParties(env: ClerkEnv) {
  const configured = env.CLERK_AUTHORIZED_PARTIES?.split(",")
    .map((party) => party.trim())
    .filter(Boolean);

  if (configured?.length) {
    return configured;
  }

  if (env.DASHBOARD_BASE_URL) {
    return [new URL(env.DASHBOARD_BASE_URL).origin];
  }

  return ["http://localhost:8787"];
}

function getPrimaryEmailAddress(user: ClerkBackendUser) {
  if (user.primaryEmailAddress?.emailAddress) {
    return user.primaryEmailAddress;
  }

  return (
    user.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId) ??
    user.emailAddresses?.[0] ??
    null
  );
}
