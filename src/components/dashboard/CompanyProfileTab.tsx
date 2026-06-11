import { Alert, Loader, Stack, Text, Title } from "@mantine/core";
import { useCompanyQuery } from "../../api/company";
import { CompanyProfileForm } from "../forms/CompanyProfileForm";

type CompanyProfileTabProps = {
  authenticated: boolean;
};

export function CompanyProfileTab({ authenticated }: CompanyProfileTabProps) {
  const companyQuery = useCompanyQuery(authenticated);
  const company = companyQuery.data?.company;

  return (
    <Stack gap="sm">
      <Title order={2} size="h4">
        Company Profile
      </Title>
      {companyQuery.isLoading || companyQuery.isFetching ? (
        <Stack align="flex-start" gap="sm">
          <Loader size="sm" aria-label="Loading company profile" />
          <Text c="dimmed">Loading company profile...</Text>
        </Stack>
      ) : companyQuery.isError ? (
        <Alert color="red" title="Company profile unavailable">
          Company profile details could not be loaded.
        </Alert>
      ) : company ? (
        <CompanyProfileForm company={company} />
      ) : (
        <Stack gap="md">
          <Text c="dimmed">
            No company profile has been created yet. Add the basic company details to create your profile.
          </Text>
          <CompanyProfileForm company={null} />
        </Stack>
      )}
    </Stack>
  );
}
