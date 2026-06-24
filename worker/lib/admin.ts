import type { UserRow } from "./db";

export type AdminEnv = {
  ADMIN_EMAILS?: string;
};

const fallbackAdminEmails = ["eckart@rslcollective.org"];

export function isAdminUser(user: UserRow, env: AdminEnv) {
  return isAdminEmail(user.email, env);
}

export function isAdminEmail(email: string, env: AdminEnv) {
  const allowedEmails = parseAdminEmails(env.ADMIN_EMAILS);
  const effectiveAllowlist = allowedEmails.length > 0 ? allowedEmails : fallbackAdminEmails;

  return effectiveAllowlist.includes(normalizeEmail(email));
}

function parseAdminEmails(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map(normalizeEmail)
      .filter(Boolean) ?? []
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
