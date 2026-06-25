import { useAuth } from "@clerk/react";
import { Alert, Button, Card, Group, Modal, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteAccountMutation } from "../../api/account";
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
  modalTitle: "Delete account?",
  modalDescription:
    "Deleting your account will permanently delete your RSL Collective account and sign you out. This action cannot be undone.",
  cancelButton: "Cancel",
  confirmButton: "Delete my account",
  errorTitle: "Account could not be deleted",
  errorDescription:
    "We could not delete your account. Please try again or contact RSL Collective support."
};

const deletedAccountRedirectPath = "/login?deleted=1";

export function AccountTab({ user, onSignOut }: AccountTabProps) {
  const { signOut } = useAuth();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const deleteAccountMutation = useDeleteAccountMutation();

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
          <Button
            color="red"
            variant="light"
            leftSection={<Trash2 size={16} />}
            onClick={() => {
              deleteAccountMutation.reset();
              setDeleteModalOpen(true);
            }}
          >
            {accountCopy.deleteButton}
          </Button>
        </Stack>
      </Card>

      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          if (!deleteAccountMutation.isPending) {
            setDeleteModalOpen(false);
          }
        }}
        title={accountCopy.modalTitle}
        centered
        transitionProps={{ duration: 0 }}
      >
        <Stack gap="md">
          <Text size="sm">{accountCopy.modalDescription}</Text>
          {deleteAccountMutation.isError ? (
            <Alert color="red" variant="light" title={accountCopy.errorTitle}>
              {accountCopy.errorDescription}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteAccountMutation.isPending}
            >
              {accountCopy.cancelButton}
            </Button>
            <Button
              color="red"
              leftSection={<Trash2 size={16} />}
              loading={deleteAccountMutation.isPending}
              onClick={() => {
                void confirmAccountDeletion();
              }}
            >
              {accountCopy.confirmButton}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );

  async function confirmAccountDeletion() {
    try {
      await deleteAccountMutation.mutateAsync();
    } catch {
      return;
    }

    try {
      await signOut({ redirectUrl: deletedAccountRedirectPath });
    } catch {
      window.location.assign(deletedAccountRedirectPath);
    }
  }
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
