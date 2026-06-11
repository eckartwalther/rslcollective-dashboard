import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiJson, apiRequest, readJsonBody } from "./client";
import { sessionQueryKey } from "./session";

export const companyQueryKey = ["company"] as const;

const allowedCompanyFields = [
  "legalName",
  "displayName",
  "companyType",
  "primaryContactName",
  "primaryContactEmail",
  "billingContactEmail",
  "country",
  "region",
  "city",
  "postalCode",
  "addressLine1",
  "addressLine2",
  "description"
] as const;

export type AllowedCompanyField = (typeof allowedCompanyFields)[number];

export type CompanyProfilePayload = Partial<Record<AllowedCompanyField, string | null>>;

export type Company = {
  legalName: string;
  displayName: string | null;
  companyType: string | null;
  primaryContactName: string;
  primaryContactEmail: string;
  billingContactEmail: string | null;
  country: string;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyResponse = {
  company: Company | null;
};

export type SaveCompanyResult = CompanyResponse & {
  created: boolean;
};

export function getCompany() {
  return apiJson<CompanyResponse>("/api/company");
}

export async function saveCompany(input: Record<string, unknown>): Promise<SaveCompanyResult> {
  const response = await apiRequest("/api/company", {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(pickCompanyProfilePayload(input))
  });
  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ApiError(apiErrorMessage(body, response), response, body);
  }

  return {
    ...(body as CompanyResponse),
    created: response.status === 201
  };
}

export function useCompanyQuery(authenticated: boolean) {
  return useQuery({
    queryKey: companyQueryKey,
    queryFn: getCompany,
    enabled: authenticated
  });
}

export function useSaveCompanyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveCompany,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: companyQueryKey });

      if (result.created) {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      }
    }
  });
}

export function pickCompanyProfilePayload(input: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  for (const field of allowedCompanyFields) {
    if (Object.hasOwn(input, field)) {
      payload[field] = input[field];
    }
  }

  return payload as CompanyProfilePayload;
}

function apiErrorMessage(body: unknown, response: Response) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object" &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return `Request failed with status ${response.status}.`;
}
