import {
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title
} from "@mantine/core";
import {
  BadgeCheck,
  Ban,
  BarChart3,
  Building2,
  ClipboardCheck,
  Library,
  Rocket
} from "lucide-react";
import type { SessionUser } from "../../api/session";
import type { Company } from "../../api/company";
import { ErrorState } from "../layout/ErrorState";
import { LoadingState } from "../layout/LoadingState";
import { PageHeader } from "../layout/PageHeader";
import { StatusCard } from "./StatusCard";

type DashboardHomeProps = {
  user: SessionUser;
  company: Company | null | undefined;
  isLoadingCompany: boolean;
  isCompanyError: boolean;
  onNavigateToCompany: () => void;
};

export function DashboardHome({
  user,
  company,
  isLoadingCompany,
  isCompanyError,
  onNavigateToCompany
}: DashboardHomeProps) {
  const hasCompany = Boolean(company ?? user.hasCompany);

  return (
    <Stack gap="lg">
      <PageHeader
        title="Dashboard"
        description="Manage the publisher profile that identifies your company for RSL Collective participation. More onboarding, repertoire, exclusion, and reporting workflows will be added here later."
        badge={
          <Badge color="blue" variant="light">
            Phase one
          </Badge>
        }
      />

      {isLoadingCompany ? <LoadingState rows={5} /> : null}

      {isCompanyError ? (
        <ErrorState
          title="Company profile unavailable"
          description="The dashboard could not load company profile details. Account information and sign-out are still available."
        />
      ) : null}

      {!isLoadingCompany && !hasCompany ? (
        <Card withBorder radius="sm" p="md">
          <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
            <Group gap="md" align="flex-start" wrap="nowrap">
              <ThemeIcon color="blue" variant="light" size="xl" radius="sm">
                <Building2 size={22} strokeWidth={1.8} />
              </ThemeIcon>
              <Stack gap="xs" maw={680}>
                <Title order={2} size="h4">
                  Create your company profile
                </Title>
                <Text size="sm" c="dimmed">
                  The company profile identifies the publisher company representative and is required before later onboarding and enrollment steps can become available.
                </Text>
                <Text size="sm" c="dimmed">
                  Only Company Profile is available in this phase.
                </Text>
              </Stack>
            </Group>
            <Button leftSection={<Building2 size={16} />} onClick={onNavigateToCompany}>
              Create company profile
            </Button>
          </Group>
        </Card>
      ) : null}

      {!isLoadingCompany && company ? (
        <Card withBorder radius="sm" p="md">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" gap="md">
              <Stack gap={4}>
                <Group gap="xs">
                  <Title order={2} size="h4">
                    Company summary
                  </Title>
                  <Badge color="green" variant="light">
                    Complete
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  Your publisher company profile is saved and ready for the next phase of the RSL Collective workflow.
                </Text>
              </Stack>
              <Button variant="default" leftSection={<Building2 size={16} />} onClick={onNavigateToCompany}>
                Edit company profile
              </Button>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <SummaryItem label="Legal name" value={company.legalName} />
              <SummaryItem label="Display name" value={company.displayName} />
              <SummaryItem label="Company type" value={company.companyType} />
              <SummaryItem label="Country" value={company.country} />
              <SummaryItem label="Primary contact" value={company.primaryContactName} />
              <SummaryItem label="Contact email" value={company.primaryContactEmail} />
            </SimpleGrid>
          </Stack>
        </Card>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <StatusCard
          title="Company profile"
          status={hasCompany ? "Complete" : "Not started"}
          description={
            hasCompany
              ? "Basic publisher identity and contact details are saved."
              : "Create the company profile before later enrollment steps can begin."
          }
          icon={Building2}
          color={hasCompany ? "green" : "yellow"}
          action={
            <Button variant="light" size="xs" w="fit-content" onClick={onNavigateToCompany}>
              {hasCompany ? "Review profile" : "Start profile"}
            </Button>
          }
        />
        <StatusCard
          title="Repertoire"
          status="Coming soon"
          description="Repertoire configuration is not available in this phase."
          icon={Library}
          color="gray"
        />
        <StatusCard
          title="Licensee exclusions"
          status="Coming soon"
          description="Licensee exclusion settings are static for now and are not connected to an API."
          icon={Ban}
          color="gray"
        />
        <StatusCard
          title="Reporting"
          status="Not configured"
          description="Reporting setup will become available in a later workflow."
          icon={BarChart3}
          color="gray"
        />
        <StatusCard
          title="Enrollment readiness"
          status={hasCompany ? "Next steps coming soon" : "Waiting for company profile"}
          description={
            hasCompany
              ? "The next onboarding steps will appear here when they are ready."
              : "Enrollment readiness depends on completing the company profile first."
          }
          icon={hasCompany ? Rocket : ClipboardCheck}
          color={hasCompany ? "blue" : "orange"}
        />
        <StatusCard
          title="License setup"
          status="Not configured"
          description="License setup is previewed here only as a future RSL Collective module."
          icon={BadgeCheck}
          color="gray"
        />
      </SimpleGrid>
    </Stack>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | null }) {
  return (
    <Stack gap={3}>
      <Text size="xs" c="dimmed" fw={600}>
        {label}
      </Text>
      <Text size="sm">{value || "Not provided"}</Text>
    </Stack>
  );
}
