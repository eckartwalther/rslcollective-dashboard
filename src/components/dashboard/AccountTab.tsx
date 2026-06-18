import { Alert, Button, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SessionUser } from "../../api/session";
import { PageHeader } from "../layout/PageHeader";

type AccountTabProps = {
  user: SessionUser;
  onSignOut: () => void;
};

const accountCopy = {
  dangerTitle: "Danger zone",
  dangerDescription:
    "Deleting your account is permanent and cannot be undone.",
  deleteButton: "Delete account",
  deleteRequestTitle: "Account deletion request",
  deleteRequestDescription:
    "Account deletion is handled by RSL Collective support for now. No account, session, or publisher profile records were deleted from this dashboard."
};

export function AccountTab({ user, onSignOut }: AccountTabProps) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const [deleteRequestVisible, setDeleteRequestVisible] = useState(false);

  return (
    <Stack gap="lg">
      <PageHeader
        title="Account Information"
        description="Review the authenticated account associated with this RSL Collective dashboard session."
      />

      <Card withBorder radius="sm" p="md">
        <Stack gap="md">
          <Title order={2} size="h4">
            Account
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <AccountField label="Email" value={user.email} />
            {fullName ? <AccountField label="Name" value={fullName} /> : null}
            <AccountField label="Account role" value={user.role} textTransform="capitalize" />
            <AccountField
              label="Publisher profile"
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

      <Card withBorder radius="sm" p="md" bd="1px solid var(--mantine-color-red-3)">
        <Stack gap="md" align="flex-start">
          <Title order={2} size="h4" c="red">
            {accountCopy.dangerTitle}
          </Title>
          <Text size="sm" c="dimmed">
            {accountCopy.dangerDescription}
          </Text>
          {deleteRequestVisible ? (
            <Alert color="red" variant="light" title={accountCopy.deleteRequestTitle}>
              {accountCopy.deleteRequestDescription}
            </Alert>
          ) : null}
          <Button
            color="red"
            variant="light"
            leftSection={<Trash2 size={16} />}
            onClick={() => setDeleteRequestVisible(true)}
          >
            {accountCopy.deleteButton}
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
