import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "./client";

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

export function getSession(authToken?: string | null) {
  return apiJson<SessionResponse>("/api/session", {}, authToken);
}

export function useSessionQuery() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      if (!isSignedIn) {
        return { authenticated: false } satisfies SessionResponse;
      }

      return getSession(await getToken());
    },
    enabled: isLoaded,
    staleTime: 30_000
  });
}
