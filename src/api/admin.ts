import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "./client";

export const adminUsersQueryKey = ["admin", "users"] as const;

export type AdminUserListItem = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  authProvider: string;
  createdAt: string;
  updatedAt: string;
  companyId: string | null;
  companyLegalName: string | null;
};

export type AdminUsersResponse = {
  users: AdminUserListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminCompanyDetail = {
  id: string;
  legalName: string | null;
  displayName: string | null;
  companyType: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  billingContactEmail: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  description: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminUserDetail = AdminUserListItem & {
  emailVerified: boolean;
  role: string;
  company: AdminCompanyDetail | null;
};

export type AdminUserDetailResponse = {
  user: AdminUserDetail;
};

export function getAdminUsers(page: number, pageSize: number, authToken?: string | null) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });

  return apiJson<AdminUsersResponse>(`/api/admin/users?${searchParams.toString()}`, {}, authToken);
}

export function getAdminUserDetail(userId: string, authToken?: string | null) {
  return apiJson<AdminUserDetailResponse>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {},
    authToken
  );
}

export function useAdminUsersQuery(page: number, pageSize: number, enabled: boolean) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery({
    queryKey: [...adminUsersQueryKey, page, pageSize],
    queryFn: async () => getAdminUsers(page, pageSize, await getToken()),
    enabled: enabled && isLoaded && isSignedIn,
    staleTime: 30_000
  });
}

export function useAdminUserDetailQuery(userId: string | null, enabled: boolean) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useQuery({
    queryKey: [...adminUsersQueryKey, userId],
    queryFn: async () => getAdminUserDetail(userId ?? "", await getToken()),
    enabled: enabled && Boolean(userId) && isLoaded && isSignedIn,
    staleTime: 30_000
  });
}
