import {
  AppShell,
  Burger,
  Button,
  Divider,
  Group,
  Image,
  NavLink,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineTheme
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Ban,
  BarChart3,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  Globe2,
  LayoutDashboard,
  Library,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "../../api/session";
import { useCompanyQuery } from "../../api/company";
import { AdminForbidden } from "../admin/AdminForbidden";
import { AdminUserDetailPage } from "../admin/AdminUserDetailPage";
import { AdminUsersPage } from "../admin/AdminUsersPage";
import { AccountTab } from "../dashboard/AccountTab";
import { CompanyProfileTab } from "../dashboard/CompanyProfileTab";
import { DashboardHome } from "../dashboard/DashboardHome";
import { LoadingState } from "./LoadingState";
import styles from "./DashboardShell.module.css";

const OnboardingGuide = lazy(() =>
  import("../dashboard/OnboardingGuide").then((module) => ({
    default: module.OnboardingGuide
  }))
);

type DashboardView = "dashboard" | "company" | "account" | "adminUsers" | "adminUserDetail" | "onboarding";

type DashboardShellProps = {
  user: SessionUser;
  isAdmin: boolean;
  onSignOut: () => void;
};

type NavigationItem = {
  label: string;
  view?: DashboardView;
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
};

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard },
  { label: "Publisher Profile", view: "company", icon: Building2 },
  { label: "Publisher Verification", icon: ShieldCheck, disabled: true, disabledReason: "Available after RSL Collective approval" },
  { label: "Repertoire", icon: Library, disabled: true, disabledReason: "Available after RSL Collective approval" },
  { label: "Licensee Exclusions", icon: Ban, disabled: true, disabledReason: "Available after RSL Collective approval" },
  { label: "Reporting", icon: BarChart3, disabled: true, disabledReason: "Available after RSL Collective approval" },
  { label: "Enrollment", icon: Globe2, disabled: true, disabledReason: "Available after RSL Collective approval" },
  { label: "Licensing Payments", icon: ClipboardCheck, disabled: true, disabledReason: "Available after RSL Collective approval" },
  { label: "Review Licensing Terms", icon: ClipboardCheck, disabled: true, disabledReason: "Available after RSL Collective approval" },
  { label: "Account Information", view: "account", icon: UserRound },
  { label: "Settings", icon: Settings, disabled: true, disabledReason: "Available after RSL Collective approval" }
];

const adminNavigationItem: NavigationItem = {
  label: "Admin",
  view: "adminUsers",
  icon: Shield
};

export function DashboardShell({ user, isAdmin, onSignOut }: DashboardShellProps) {
  const theme = useMantineTheme();
  const [opened, { close, toggle }] = useDisclosure();
  const [activeView, setActiveView] = useState<DashboardView>(() => viewFromPathname());
  const companyQuery = useCompanyQuery(true);
  const company = companyQuery.data?.company;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(viewFromPathname());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const activeTitle = useMemo(() => {
    if (activeView === "adminUsers" || activeView === "adminUserDetail") {
      return "Admin";
    }

    if (activeView === "company") {
      return "Publisher Profile";
    }

    if (activeView === "account") {
      return "Account Information";
    }

    if (activeView === "onboarding") {
      return "Onboarding Guide";
    }

    return "Dashboard";
  }, [activeView]);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !opened }
      }}
      padding="lg"
      bg={activeView === "onboarding" ? "white" : "gray.0"}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <UnstyledButton
              aria-label="RSL Internet Collective dashboard"
              onClick={() => navigateToView("dashboard")}
            >
              <Image
                src="/brand/rsl-internet-collective-logo.svg"
                alt="RSL Internet Collective"
                h={32}
                w="auto"
                fit="contain"
              />
            </UnstyledButton>
          </Group>

          <Group className={styles.accountCluster} wrap="nowrap">
            <Stack className={styles.accountIdentity} visibleFrom="xs">
              <Text className={styles.accountName} truncate="end" maw={220}>
                {fullName || user.email}
              </Text>
              <Text className={styles.accountEmail} truncate="end" maw={220}>
                {user.email}
              </Text>
            </Stack>
            <Tooltip label="Sign out">
              <Button
                variant="default"
                leftSection={<LogOut size={16} />}
                className={styles.signOutButton}
                onClick={onSignOut}
              >
                Sign out
              </Button>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" className={styles.navbar}>
        <Stack gap="lg" h="100%">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" className={styles.workspaceLabel}>
              Workspace
            </Text>
            <Text size="sm" fw={600}>
              {company?.displayName || company?.legalName || "Publisher profile"}
            </Text>
          </Stack>

          <Stack className={styles.navigation} data-testid="dashboard-navigation">
            {[...navigationItems, ...(isAdmin ? [adminNavigationItem] : [])].map((item) => {
              const Icon = item.icon;
              const active = Boolean(
                item.view &&
                  (item.view === activeView ||
                    (item.view === "adminUsers" && activeView === "adminUserDetail"))
              );

              return (
                <NavLink
                  key={item.label}
                  component="button"
                  type="button"
                  label={item.label}
                  leftSection={<Icon size={16} strokeWidth={1.8} />}
                  title={item.disabledReason}
                  aria-label={item.disabled ? `${item.label}. ${item.disabledReason}` : item.label}
                  active={active}
                  disabled={item.disabled}
                  className={styles.navLink}
                  color={theme.primaryColor}
                  onClick={() => {
                    if (item.view) {
                      navigateToView(item.view);
                      close();
                    }
                  }}
                />
              );
            })}

            <Divider
              className={styles.onboardingDivider}
              data-testid="onboarding-guide-divider"
            />
            <NavLink
              component="a"
              data-testid="dashboard-help-navigation"
              href="/dashboard/onboarding"
              label="Onboarding Guide"
              aria-label="Onboarding Guide"
              leftSection={<BookOpenCheck size={16} strokeWidth={1.8} />}
              active={activeView === "onboarding"}
              className={styles.navLink}
              color={theme.primaryColor}
              onClick={(event) => {
                event.preventDefault();
                navigateToView("onboarding");
                close();
              }}
            />
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack gap="lg" maw={1120}>
          {activeView !== "onboarding" ? (
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              {activeTitle}
            </Text>
          ) : null}
          {activeView === "dashboard" ? (
            <DashboardHome
              user={user}
              company={company}
              isLoadingCompany={companyQuery.isLoading || companyQuery.isFetching}
              isCompanyError={companyQuery.isError}
              onNavigateToCompany={() => navigateToView("company")}
              onNavigateToOnboarding={() => navigateToView("onboarding")}
            />
          ) : null}
          {activeView === "onboarding" ? (
            <Suspense fallback={<LoadingState rows={6} />}>
              <OnboardingGuide />
            </Suspense>
          ) : null}
          {activeView === "company" ? <CompanyProfileTab authenticated /> : null}
          {activeView === "account" ? <AccountTab user={user} onSignOut={onSignOut} /> : null}
          {activeView === "adminUsers" ? (
            isAdmin ? (
              <AdminUsersPage
                enabled={isAdmin}
                onSelectUser={(userId) => {
                  navigateToPath(`/admin/users/${userId}`, "adminUserDetail");
                  close();
                }}
              />
            ) : (
              <AdminForbidden onBackToDashboard={() => navigateToView("dashboard")} />
            )
          ) : null}
          {activeView === "adminUserDetail" ? (
            isAdmin ? (
              <AdminUserDetailPage
                enabled={isAdmin}
                userId={adminUserIdFromPathname()}
                onBack={() => navigateToPath("/admin/users", "adminUsers")}
              />
            ) : (
              <AdminForbidden onBackToDashboard={() => navigateToView("dashboard")} />
            )
          ) : null}
          <footer className={styles.footer}>
            <Text component="span" className={styles.footerCopyright}>
              Copyright © 2026 RSL Internet Collective
            </Text>
            <nav aria-label="Legal" className={styles.footerNav}>
              <a className={styles.footerLink} href="https://rslcollective.org/legal/tos">
                Terms
              </a>
              <a className={styles.footerLink} href="https://rslcollective.org/legal/privacy">
                Privacy
              </a>
            </nav>
          </footer>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );

  function navigateToView(view: DashboardView) {
    navigateToPath(pathForView(view), view);
  }

  function navigateToPath(path: string, view: DashboardView) {
    setActiveView(view);

    if (window.location.pathname !== path || window.location.search) {
      window.history.pushState(null, "", path);
    }
  }
}

function viewFromPathname(): DashboardView {
  if (window.location.pathname.startsWith("/admin/users/")) {
    return "adminUserDetail";
  }

  if (window.location.pathname === "/admin/users") {
    return "adminUsers";
  }

  if (window.location.pathname.endsWith("/onboarding")) {
    return "onboarding";
  }

  if (window.location.pathname.endsWith("/company")) {
    return "company";
  }

  if (window.location.pathname.endsWith("/account")) {
    return "account";
  }

  return "dashboard";
}

function pathForView(view: DashboardView) {
  if (view === "company") {
    return "/dashboard/company";
  }

  if (view === "account") {
    return "/dashboard/account";
  }

  if (view === "adminUsers") {
    return "/admin/users";
  }

  if (view === "adminUserDetail") {
    return window.location.pathname.startsWith("/admin/users/")
      ? window.location.pathname
      : "/admin/users";
  }

  if (view === "onboarding") {
    return "/dashboard/onboarding";
  }

  return "/dashboard";
}

function adminUserIdFromPathname() {
  const prefix = "/admin/users/";

  if (!window.location.pathname.startsWith(prefix)) {
    return null;
  }

  return decodeURIComponent(window.location.pathname.slice(prefix.length));
}
