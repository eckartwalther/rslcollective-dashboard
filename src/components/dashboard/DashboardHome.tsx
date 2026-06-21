import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  SimpleGrid,
  Stack,
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
import styles from "./DashboardHome.module.css";

type DashboardHomeProps = {
  user: SessionUser;
  company: Company | null | undefined;
  isLoadingCompany: boolean;
  isCompanyError: boolean;
  onNavigateToCompany: () => void;
  onNavigateToOnboarding: () => void;
};

const dashboardCopy = {
  header: {
    title: "Dashboard",
    badge: "Beta"
  },
  gettingStarted: {
    sectionTitle: "Getting started",
    noProfileHeading: "Turn AI use of your content into licensing revenue",
    noProfileAction: "Create publisher profile",
    submittedAction: "Edit publisher profile"
  },
  cards: {
    publisherProfile: {
      title: "Create publisher profile",
      description: "Tell us who you are so we can verify your organization and prepare your account for licensing."
    },
    verification: {
      title: "Complete verification",
      description: "Confirm your eligibility to participate in RSL Collective licensing."
    },
    licensingTerms: {
      title: "Accept licensing terms",
      description: "Review and accept the terms that allow the Collective to license eligible content on your behalf."
    }
  },
  modules: [
    {
      title: "Register content",
      description: "Enroll the websites, subdomains, and RSL declarations you want included in collective licensing.",
      icon: Library
    },
    {
      title: "Manage licensees",
      description: "Exclude specific participating licensees from access to selected licensable content.",
      icon: Ban
    },
    {
      title: "View reports",
      description: "Track usage, licensing activity, settlements, and royalty reporting.",
      icon: BarChart3
    },
    {
      title: "Set up payouts",
      description: "Add payment details so royalties can be distributed when licensees use your content.",
      icon: CreditCard
    }
  ]
};

const primaryActionProps = {
  variant: "light",
  color: "blue",
  size: "sm",
  radius: "md",
  w: "fit-content"
} as const;

const gettingStartedSteps = [
  "Join the RSL Collective and accept the collective licensing terms.",
  "Publish and register RSL declarations for eligible content.",
  "Receive reporting and royalty payments when licensees use your content."
];

export function DashboardHome({
  user,
  company,
  isLoadingCompany,
  isCompanyError,
  onNavigateToCompany,
  onNavigateToOnboarding
}: DashboardHomeProps) {
  const hasCompany = Boolean(company ?? user.hasCompany);
  const [showGettingStarted, setShowGettingStarted] = useState(true);

  return (
    <Stack gap="lg">
      <PageHeader
        title={dashboardCopy.header.title}
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
        <Card
          withBorder
          radius="sm"
          p="md"
          className={styles.gettingStartedCard}
          data-testid="dashboard-getting-started-card"
        >
          <ActionIcon
            aria-label="Dismiss getting started"
            variant="subtle"
            color="gray"
            size="sm"
            radius="md"
            className={styles.gettingStartedDismiss}
            onClick={() => setShowGettingStarted(false)}
          >
            <X size={16} aria-hidden="true" />
          </ActionIcon>
          <Stack gap={0} maw={720}>
            <Title order={2} size="h4" className={styles.gettingStartedTitle}>
              {dashboardCopy.gettingStarted.noProfileHeading}
            </Title>
            <ol className={styles.gettingStartedSteps} aria-label="Getting started steps">
              {gettingStartedSteps.map((step, index) => (
                <li className={styles.gettingStartedStep} data-testid="getting-started-step" key={step}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.stepText}>{step}</span>
                </li>
              ))}
            </ol>
            <div className={styles.gettingStartedFooter}>
              <Anchor
                href="/dashboard/onboarding"
                className={styles.gettingStartedGuideLink}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigateToOnboarding();
                }}
              >
                Read the publisher onboarding guide →
              </Anchor>
            </div>
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
            <Button
              data-dashboard-action="restrained"
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
              data-dashboard-action="restrained"
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
