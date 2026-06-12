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
        title="Company Profile"
        description="Create or edit the publisher company details used for the phase-one RSL Collective profile application."
      />
      {companyQuery.isLoading || companyQuery.isFetching ? (
        <Stack gap="sm">
          <Text c="dimmed" size="sm">
            Loading company profile...
          </Text>
          <LoadingState rows={6} />
        </Stack>
      ) : companyQuery.isError ? (
        <ErrorState
          title="Company profile unavailable"
          description="Company profile details could not be loaded."
        />
      ) : company ? (
        <CompanyProfileForm company={company} />
      ) : (
        <Stack gap="md">
          <EmptyState
            title="No company profile"
            description="No company profile has been created yet. Add the basic company details to create your profile."
            action={
              <Button variant="light" size="xs" disabled>
                Profile form ready below
              </Button>
            }
          />
          <Text c="dimmed" size="sm">
            Fields are limited to the phase-one company profile scope.
          </Text>
          <CompanyProfileForm company={null} />
        </Stack>
      )}
    </Stack>
  );
}
