import { AppShell, Button, Container, Group, Stack, Tabs, Text, Title } from "@mantine/core";
import { Building2, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { SessionUser } from "../../api/session";
import { AccountTab } from "../dashboard/AccountTab";
import { CompanyProfileTab } from "../dashboard/CompanyProfileTab";

type DashboardShellProps = {
  user: SessionUser;
  onSignOut: () => void;
};

export function DashboardShell({ user, onSignOut }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<string | null>(
    user.hasCompany ? "account" : "company"
  );

  useEffect(() => {
    if (!user.hasCompany) {
      setActiveTab("company");
    }
  }, [user.hasCompany]);

  return (
    <AppShell header={{ height: 72 }} padding="md" bg="gray.0">
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Stack gap={0}>
              <Title order={2} size="h3">
                RSL Collective
              </Title>
              <Text size="sm" c="dimmed">
                Profile dashboard
              </Text>
            </Stack>
            <Group gap="md" wrap="nowrap">
              <Text size="sm" c="dimmed">
                {user.email}
              </Text>
              <Button
                variant="default"
                leftSection={<LogOut size={16} />}
                onClick={onSignOut}
              >
                Sign out
              </Button>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg">
          <Stack gap="lg">
            <Title order={1}>Dashboard</Title>
            <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="account" leftSection={<UserRound size={16} />}>
                  Account Information
                </Tabs.Tab>
                <Tabs.Tab value="company" leftSection={<Building2 size={16} />}>
                  Company Profile
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="account" pt="md">
                <AccountTab user={user} onSignOut={onSignOut} />
              </Tabs.Panel>
              <Tabs.Panel value="company" pt="md">
                <CompanyProfileTab authenticated />
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
