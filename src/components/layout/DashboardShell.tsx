import {
  AppShell,
  Badge,
  Burger,
  Button,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  Tooltip,
  useMantineTheme
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Ban,
  BarChart3,
  Building2,
  LayoutDashboard,
  Library,
  LogOut,
  Settings,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "../../api/session";
import { useCompanyQuery } from "../../api/company";
import { AccountTab } from "../dashboard/AccountTab";
import { CompanyProfileTab } from "../dashboard/CompanyProfileTab";
import { DashboardHome } from "../dashboard/DashboardHome";

type DashboardView = "dashboard" | "company" | "account";

type DashboardShellProps = {
  user: SessionUser;
  onSignOut: () => void;
};

type NavigationItem = {
  label: string;
  view?: DashboardView;
  icon: LucideIcon;
  disabled?: boolean;
};

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard },
  { label: "Company Profile", view: "company", icon: Building2 },
  { label: "Account Information", view: "account", icon: UserRound },
  { label: "Repertoire", icon: Library, disabled: true },
  { label: "Licensee Exclusions", icon: Ban, disabled: true },
  { label: "Reporting", icon: BarChart3, disabled: true },
  { label: "Settings", icon: Settings, disabled: true }
];

export function DashboardShell({ user, onSignOut }: DashboardShellProps) {
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
    if (activeView === "company") {
      return "Company Profile";
    }

    if (activeView === "account") {
      return "Account Information";
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
      bg="gray.0"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Stack gap={0}>
              <Group gap={8} wrap="nowrap">
                <Title order={2} size="h4" lh={1}>
                  RSL Collective
                </Title>
              </Group>
              <Text size="xs" c="dimmed">
                Profile application
              </Text>
            </Stack>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <Stack gap={0} align="flex-end" visibleFrom="xs">
              <Text size="sm" fw={500} truncate="end" maw={220}>
                {fullName || user.email}
              </Text>
              <Text size="xs" c="dimmed" truncate="end" maw={220}>
                {user.email}
              </Text>
            </Stack>
            <Tooltip label="Sign out">
              <Button
                variant="default"
                leftSection={<LogOut size={16} />}
                onClick={onSignOut}
              >
                Sign out
              </Button>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="lg" h="100%">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Workspace
            </Text>
            <Text size="sm" fw={600}>
              {company?.displayName || company?.legalName || "Publisher profile"}
            </Text>
          </Stack>

          <Stack gap="xs">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = Boolean(item.view && item.view === activeView);

              return (
                <NavLink
                  key={item.label}
                  component="button"
                  type="button"
                  label={item.label}
                  leftSection={<Icon size={16} strokeWidth={1.8} />}
                  rightSection={
                    item.disabled ? (
                      <Badge size="xs" color="gray" variant="light">
                        Soon
                      </Badge>
                    ) : null
                  }
                  active={active}
                  disabled={item.disabled}
                  color={theme.primaryColor}
                  onClick={() => {
                    if (item.view) {
                      navigateToView(item.view);
                      close();
                    }
                  }}
                  styles={{
                    root: {
                      borderRadius: 6,
                      minHeight: 34
                    },
                    label: {
                      fontSize: 14
                    },
                    section: {
                      color: active
                        ? `var(--mantine-color-${theme.primaryColor}-7)`
                        : "var(--mantine-color-gray-6)"
                    }
                  }}
                />
              );
            })}
          </Stack>

          <Stack gap="xs" mt="auto">
            <Text size="xs" c="dimmed">
              Future modules are visible for orientation only. They are not configured yet.
            </Text>
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack gap="lg" maw={1120}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {activeTitle}
          </Text>
          {activeView === "dashboard" ? (
            <DashboardHome
              user={user}
              company={company}
              isLoadingCompany={companyQuery.isLoading || companyQuery.isFetching}
              isCompanyError={companyQuery.isError}
              onNavigateToCompany={() => navigateToView("company")}
            />
          ) : null}
          {activeView === "company" ? <CompanyProfileTab authenticated /> : null}
          {activeView === "account" ? <AccountTab user={user} onSignOut={onSignOut} /> : null}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );

  function navigateToView(view: DashboardView) {
    setActiveView(view);

    const nextPath = pathForView(view);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }
}

function viewFromPathname(): DashboardView {
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

  return "/dashboard";
}
