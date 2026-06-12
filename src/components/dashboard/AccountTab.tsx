import { Badge, Button, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { LogOut } from "lucide-react";
import type { SessionUser } from "../../api/session";
import { PageHeader } from "../layout/PageHeader";

type AccountTabProps = {
  user: SessionUser;
  onSignOut: () => void;
};

export function AccountTab({ user, onSignOut }: AccountTabProps) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <Stack gap="lg">
      <PageHeader
        title="Account Information"
        description="Review the authenticated account associated with this RSL Collective profile application session."
        badge={
          <Badge color={user.hasCompany ? "green" : "yellow"} variant="light">
            {user.hasCompany ? "Company profile complete" : "Company profile needed"}
          </Badge>
        }
      />

      <Card withBorder radius="sm" p="md">
        <Stack gap="md">
          <Title order={2} size="h4">
            Account
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <AccountField label="Email" value={user.email} />
            {fullName ? <AccountField label="Name" value={fullName} /> : null}
            <AccountField label="Company role" value={user.role} textTransform="capitalize" />
            <AccountField
              label="Company profile"
              value={user.hasCompany ? "Exists" : "Not created"}
            />
          </SimpleGrid>
          <Button
            variant="default"
            leftSection={<LogOut size={16} />}
            onClick={onSignOut}
            w="fit-content"
          >
            Sign out
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}

function AccountField({
  label,
  value,
  textTransform
}: {
  label: string;
  value: string;
  textTransform?: "capitalize";
}) {
  return (
    <Stack gap={4}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text tt={textTransform}>{value}</Text>
    </Stack>
  );
}
