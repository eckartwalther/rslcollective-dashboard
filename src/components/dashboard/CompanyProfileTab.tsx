import { Button, Stack, Text } from "@mantine/core";
import { useCompanyQuery } from "../../api/company";
import { CompanyProfileForm } from "../forms/CompanyProfileForm";
import { EmptyState } from "../layout/EmptyState";
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
        description="Create or edit the publisher details used for the phase-one RSL Collective profile application."
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
        <Stack gap="md">
          <EmptyState
            title="No publisher profile"
            description="No publisher profile has been created yet. Add the basic publisher details to create your profile."
            action={
              <Button variant="light" size="xs" disabled>
                Profile form ready below
              </Button>
            }
          />
          <Text c="dimmed" size="sm">
            Fields are limited to the phase-one publisher profile scope.
          </Text>
          <CompanyProfileForm company={null} />
        </Stack>
      )}
    </Stack>
  );
}
