import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  List,
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
  ShieldCheck,
  X
} from "lucide-react";
import { useState } from "react";
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
    description: "License your content and receive royalties through the RSL Collective"
  },
  gettingStarted: {
    sectionTitle: "Getting started",
    description:
      "Add your publisher information so the RSL Collective can review your organization and prepare your account for licensing.",
    noProfileHeading: "Create publisher profile",
    noProfileAction: "Create publisher profile",
    submittedAction: "Edit publisher profile"
  },
  cards: {
    publisherProfile: {
      title: "Create profile",
      description: "Define and edit your company information."
    },
    verification: {
      title: "Complete verification",
      description: "Verify your company's eligibility for RSL Collective participation."
    },
    licensingTerms: {
      title: "Accept licensing terms",
      description: "Review and agree to the RSL Collective licensing terms."
    }
  },
  modules: [
    {
      title: "Register content",
      description: "Define your collectively licensable content.",
      icon: Library
    },
    {
      title: "Exclude licensees",
      description: "Exclude specific licensees from accessing your licensable content.",
      icon: Ban
    },
    {
      title: "View reports",
      description: "Review usage, licensing, settlement, and royalty reports.",
      icon: BarChart3
    },
    {
      title: "Set up payments",
      description: "Configure payment information to receive licensing payments.",
      icon: CreditCard
    }
  ]
};

const primaryActionProps = {
  size: "sm",
  radius: "md",
  w: "fit-content"
} as const;

const gettingStartedSteps = [
  "Create your publisher profile.",
  "Prepare RSL declarations for the content you want to license.",
  "Publish RSL files and link them from robots.txt.",
  "Enroll each participating website or subdomain root after publisher verification and licensing review.",
  "Keep RSL files and enrollment information current as content, rights, and licensing boundaries change."
];

export function DashboardHome({
  user,
  company,
  isLoadingCompany,
  isCompanyError,
  onNavigateToCompany
}: DashboardHomeProps) {
  const hasCompany = Boolean(company ?? user.hasCompany);
  const [showGettingStarted, setShowGettingStarted] = useState(true);

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

      {!isLoadingCompany && showGettingStarted ? (
        <Card withBorder radius="sm" p="md" data-testid="dashboard-getting-started-card">
          <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
            <Group gap="md" align="flex-start" wrap="nowrap">
              <ThemeIcon color="blue" variant="light" size="xl" radius="sm">
                <Building2 size={22} strokeWidth={1.8} />
              </ThemeIcon>
              <Stack gap="xs" maw={720}>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  {dashboardCopy.gettingStarted.sectionTitle}
                </Text>
                <Title order={2} size="h4">
                  {dashboardCopy.gettingStarted.noProfileHeading}
                </Title>
                <Text size="sm" c="dimmed">
                  {dashboardCopy.gettingStarted.description}
                </Text>
                <List size="sm" spacing={6} c="dimmed" mt={4}>
                  {gettingStartedSteps.map((step) => (
                    <List.Item key={step}>{step}</List.Item>
                  ))}
                </List>
              </Stack>
            </Group>
            <ActionIcon
              aria-label="Dismiss getting started"
              variant="subtle"
              color="gray"
              size="sm"
              radius="md"
              onClick={() => setShowGettingStarted(false)}
            >
              <X size={16} aria-hidden="true" />
            </ActionIcon>
          </Group>
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
            <Button
              data-dashboard-action="compact"
              data-testid="dashboard-define-profile-action"
              leftSection={<Building2 size={16} />}
              onClick={onNavigateToCompany}
              {...primaryActionProps}
            >
              {hasCompany
                ? dashboardCopy.gettingStarted.submittedAction
                : dashboardCopy.gettingStarted.noProfileAction}
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
            <Button
              data-dashboard-action="compact"
              data-testid="dashboard-verify-profile-action"
              disabled
              {...primaryActionProps}
            >
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
