import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import { LogOut } from "lucide-react";
import type { SessionUser } from "../../api/session";

type AccountTabProps = {
  user: SessionUser;
  onSignOut: () => void;
};

export function AccountTab({ user, onSignOut }: AccountTabProps) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Title order={2} size="h4">
          Account Information
        </Title>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Email
          </Text>
          <Text>{user.email}</Text>
        </Stack>
        {fullName ? (
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Name
            </Text>
            <Text>{fullName}</Text>
          </Stack>
        ) : null}
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Company role
          </Text>
          <Text tt="capitalize">{user.role}</Text>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Company profile
          </Text>
          <Text>{user.hasCompany ? "Exists" : "Not created"}</Text>
        </Stack>
        <Button
          variant="default"
          leftSection={<LogOut size={16} />}
          onClick={onSignOut}
          w="fit-content"
        >
          Sign out
        </Button>
      </Stack>
    </Paper>
  );
}
