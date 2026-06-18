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
  header: {
    title: "Dashboard",
    badge: "Beta",
    description: "License your content and receive royalties through the RSL Collective."
  },
  gettingStarted: {
    sectionTitle: "Getting started",
    noProfileHeading: "Create publisher profile",
    noProfileDescription: "Submit your publisher information for RSL Collective verification.",
    noProfileAction: "Create publisher profile",
    submittedHeading: "Publisher profile submitted",
    submittedDescription: "Your publisher profile is under review.",
    submittedAction: "Edit publisher profile"
  },
  cards: {
    publisherProfile: {
      title: "Create and verify publisher profile",
      description: "Submit your publisher identity, contact, and business information."
    },
    verification: {
      title: "Complete publisher verification",
      description: "Verify your profile information for RSL Collective participation."
    },
    licensingTerms: {
      title: "Review licensing terms",
      description: "Review and agree to the RSL Collective licensing terms."
    }
  },
  modules: [
    {
      title: "Define licensable content",
      description: "Identify the content you want to license through the RSL Collective licensing.",
      icon: Library
    },
    {
      title: "Manage licensee exclusions",
      description: "Exclude specific licensees from accessing your licensable content.",
      icon: Ban
    },
    {
      title: "View licensing and settlement reports",
      description: "Review your usage, licensing, settlement, and royalty reports.",
      icon: BarChart3
    },
    {
      title: "Set up royalty payments",
      description: "Configure your payment details for receiving royalty payments distributions.",
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

  return (
    <Stack gap="lg">
      <PageHeader
        title={dashboardCopy.header.title}
        description={dashboardCopy.header.description}
        badge={
          <Badge color="blue" variant="light">
            {dashboardCopy.header.badge}
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
          <Group gap="md" align="flex-start" wrap="nowrap">
            <ThemeIcon color="blue" variant="light" size="xl" radius="sm">
              <Building2 size={22} strokeWidth={1.8} />
            </ThemeIcon>
            <Stack gap="xs" maw={680}>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                {dashboardCopy.gettingStarted.sectionTitle}
              </Text>
              <Title order={2} size="h4">
                {dashboardCopy.gettingStarted.noProfileHeading}
              </Title>
              <Text size="sm" c="dimmed">
                {dashboardCopy.gettingStarted.noProfileDescription}
              </Text>
            </Stack>
          </Group>
        </Card>
      ) : null}

      {!isLoadingCompany && company ? (
        <Card withBorder radius="sm" p="md">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" gap="md">
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  {dashboardCopy.gettingStarted.sectionTitle}
                </Text>
                <Group gap="xs">
                  <Title order={2} size="h4">
                    {dashboardCopy.gettingStarted.submittedHeading}
                  </Title>
                  <Badge color="green" variant="light">
                    Complete
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {dashboardCopy.gettingStarted.submittedDescription}
                </Text>
              </Stack>
              <Button variant="default" leftSection={<Building2 size={16} />} onClick={onNavigateToCompany}>
                {dashboardCopy.gettingStarted.submittedAction}
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
          title={dashboardCopy.cards.publisherProfile.title}
          status={hasCompany ? "Complete" : "Not started"}
          description={dashboardCopy.cards.publisherProfile.description}
          icon={Building2}
          color={hasCompany ? "green" : "yellow"}
          action={
            <Button variant="light" size="xs" w="fit-content" onClick={onNavigateToCompany}>
              {hasCompany ? "Review profile" : dashboardCopy.gettingStarted.noProfileAction}
            </Button>
          }
        />
        <StatusCard
          title={dashboardCopy.cards.verification.title}
          status={hasCompany ? "Pending verification" : "Pending profile"}
          description={dashboardCopy.cards.verification.description}
          icon={ShieldCheck}
          color={hasCompany ? "yellow" : "orange"}
          action={
            <Button variant="light" size="xs" w="fit-content" disabled>
              Verify profile
            </Button>
          }
        />
        <StatusCard
          title={dashboardCopy.cards.licensingTerms.title}
          status="Pending verification"
          description={dashboardCopy.cards.licensingTerms.description}
          icon={ClipboardCheck}
          color="gray"
        />
        {dashboardCopy.modules.map((module) => (
          <StatusCard
            key={module.title}
            title={module.title}
            status="Pending verification"
            description={module.description}
            icon={module.icon}
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
