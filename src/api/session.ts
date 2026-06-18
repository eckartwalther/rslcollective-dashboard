import { useQuery } from "@tanstack/react-query";
import { apiJson } from "./client";
import { browserRuntimeSnapshot, isFrontendRuntimeDiagnosticsEnabled } from "./runtimeDiagnostics";

export const sessionQueryKey = ["session"] as const;

export type SessionUser = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  hasCompany: boolean;
};

export type SessionResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      user: SessionUser;
    };

export function getSession() {
  return apiJson<SessionResponse>("/api/session");
}

export function useSessionQuery() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: getSession,
    staleTime: 30_000
  });
}

export function signOut() {
  const form = document.createElement("form");

  form.method = "POST";
  form.action = "/logout";
  form.style.display = "none";
  document.body.appendChild(form);
  logLogoutSubmitDebug(form);
  form.submit();
}

function logLogoutSubmitDebug(form: HTMLFormElement) {
  if (!isFrontendRuntimeDiagnosticsEnabled()) {
    return;
  }

  console.info({
    event: "logout_submit_debug",
    ...browserRuntimeSnapshot(),
    formAction: form.action,
    formMethod: form.method
  });
}
