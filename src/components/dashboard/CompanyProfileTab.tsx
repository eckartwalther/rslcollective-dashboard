import { Stack, Text } from "@mantine/core";
import { useCompanyQuery } from "../../api/company";
import { CompanyProfileForm } from "../forms/CompanyProfileForm";
import { ErrorState } from "../layout/ErrorState";
import { LoadingState } from "../layout/LoadingState";
import { PageHeader } from "../layout/PageHeader";

type CompanyProfileTabProps = {
  authenticated: boolean;
};

export function CompanyProfileTab({ authenticated }: CompanyProfileTabProps) {
  const companyQuery = useCompanyQuery(authenticated);
  const company = companyQuery.data?.company;

  return (
    <Stack gap="lg">
      <PageHeader
        title="Publisher Profile"
        description="Create or edit company information."
      />
      {companyQuery.isLoading || companyQuery.isFetching ? (
        <Stack gap="sm">
          <Text c="dimmed" size="sm">
            Loading publisher profile...
          </Text>
          <LoadingState rows={6} />
        </Stack>
      ) : companyQuery.isError ? (
        <ErrorState
          title="Publisher profile unavailable"
          description="Publisher profile details could not be loaded."
        />
      ) : company ? (
        <CompanyProfileForm company={company} />
      ) : (
        <CompanyProfileForm company={null} />
      )}
    </Stack>
  );
}
