import { useAuth } from "@clerk/react";
import { useMutation } from "@tanstack/react-query";
import { apiJson } from "./client";

export type DeleteAccountResponse = {
  deleted: true;
};

export function deleteAccount(authToken?: string | null) {
  return apiJson<DeleteAccountResponse>(
    "/api/account",
    {
      method: "DELETE"
    },
    authToken
  );
}

export function useDeleteAccountMutation() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async () => deleteAccount(await getToken())
  });
}
