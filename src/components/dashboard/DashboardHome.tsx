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
  Ban,
  BarChart3,
  Building2,
  ClipboardCheck,
  CreditCard,
  Library,
  ShieldCheck
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

const dashboardCopy = {
  headerDescription:
    "Manage the publisher profile that identifies your organization for RSL Collective participation. RSL Collective review and approval unlock the additional repertoire, exclusion, reporting, enrollment, and payment capabilities in this workflow.",
  noCompanyNextStep:
    "Create your publisher profile so the RSL Collective can verify your publisher account.",
  noCompanyVerification:
    "Verification begins after the profile is complete. Additional capabilities remain locked until publisher approval.",
  companyReview:
    "Your publisher profile is saved. The RSL Collective will review and approve the publisher before enabling additional capabilities.",
  companyProfile: {
    title: "Publisher profile",
    complete: "Basic publisher identity and contact details are saved.",
    notStarted: "Create the publisher profile to begin publisher verification."
  },
  verification: {
    title: "Publisher verification",
    pendingReview:
      "Complete and verify your RSL Collective publisher profile.",
    waitingForProfile: "Complete and verify your RSL Collective publisher profile."
  },
  capabilities: [
    {
      title: "Define your licensable content repertoire",
      approvedDescription: "Repertoire setup is available after publisher approval and onboarding.",
      waitingDescription: "Repertoire setup is locked until publisher verification can begin.",
      icon: Library
    },
    {
      title: "Manage licensee exclusions",
      approvedDescription: "Licensee exclusion controls are available after RSL Collective approval.",
      waitingDescription: "Licensee exclusion controls are locked until publisher verification can begin.",
      icon: Ban
    },
    {
      title: "Review reporting activity",
      approvedDescription: "Reporting access is available after approval and onboarding.",
      waitingDescription: "Reporting access is locked until publisher verification can begin.",
      icon: BarChart3
    },
    {
      title: "Prepare enrollment readiness",
      approvedDescription: "Enrollment readiness depends on RSL Collective approval of this publisher.",
      waitingDescription: "Complete the publisher profile to begin publisher verification.",
      icon: ClipboardCheck
    },
    {
      title: "Set up licensing payments",
      approvedDescription: "Payment setup is available after publisher approval and onboarding.",
      waitingDescription: "Payment setup is locked until publisher verification can begin.",
      icon: CreditCard
    }
  ]
};

export function DashboardHome({
  user,
  company,
  isLoadingCompany,
  isCompanyError,
  onNavigateToCompany
}: DashboardHomeProps) {
  const hasCompany = Boolean(company ?? user.hasCompany);
  const verificationStatus = hasCompany ? "Pending review" : "Waiting for publisher profile";
  const capabilityStatus = hasCompany ? "Pending approval" : "Pending verification";

  return (
    <Stack gap="lg">
      <PageHeader
        title="Dashboard"
        description={dashboardCopy.headerDescription}
        badge={
          <Badge color="blue" variant="light">
            Beta
          </Badge>
        }
      />

      {isLoadingCompany ? <LoadingState rows={5} /> : null}

      {isCompanyError ? (
        <ErrorState
          title="Publisher profile unavailable"
          description="The dashboard could not load publisher profile details. Account information and sign-out are still available."
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
                  Create your publisher profile
                </Title>
                <Text size="sm" c="dimmed">
                  {dashboardCopy.noCompanyNextStep}
                </Text>
                <Text size="sm" c="dimmed">
                  {dashboardCopy.noCompanyVerification}
                </Text>
              </Stack>
            </Group>
            <Button leftSection={<Building2 size={16} />} onClick={onNavigateToCompany}>
              Create publisher profile
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
                    Publisher summary
                  </Title>
                  <Badge color="green" variant="light">
                    Complete
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {dashboardCopy.companyReview}
                </Text>
                <Badge color="yellow" variant="light" w="fit-content">
                  Publisher verification: Pending review
                </Badge>
              </Stack>
              <Button variant="default" leftSection={<Building2 size={16} />} onClick={onNavigateToCompany}>
                Edit publisher profile
              </Button>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <SummaryItem label="Legal name" value={company.legalName} />
              <SummaryItem label="Display name" value={company.displayName} />
              <SummaryItem label="Publisher type" value={company.companyType} />
              <SummaryItem label="Country" value={company.country} />
              <SummaryItem label="Primary contact" value={company.primaryContactName} />
              <SummaryItem label="Contact email" value={company.primaryContactEmail} />
            </SimpleGrid>
          </Stack>
        </Card>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <StatusCard
          title={dashboardCopy.companyProfile.title}
          status={hasCompany ? "Complete" : "Not started"}
          description={
            hasCompany
              ? dashboardCopy.companyProfile.complete
              : dashboardCopy.companyProfile.notStarted
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
          title={dashboardCopy.verification.title}
          status={verificationStatus}
          description={
            hasCompany
              ? dashboardCopy.verification.pendingReview
              : dashboardCopy.verification.waitingForProfile
          }
          icon={ShieldCheck}
          color={hasCompany ? "yellow" : "orange"}
        />
        {dashboardCopy.capabilities.map((capability) => (
          <StatusCard
            key={capability.title}
            title={capability.title}
            status={capabilityStatus}
            description={
              hasCompany ? capability.approvedDescription : capability.waitingDescription
            }
            icon={capability.icon}
            color="gray"
          />
        ))}
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
