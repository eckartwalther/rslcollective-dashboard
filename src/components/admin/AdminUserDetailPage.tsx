import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { useAdminUserDetailQuery } from "../../api/admin";
import { ApiError } from "../../api/client";
import { EmptyState } from "../layout/EmptyState";
import { ErrorState } from "../layout/ErrorState";
import { LoadingState } from "../layout/LoadingState";

type AdminUserDetailPageProps = {
  enabled: boolean;
  userId: string | null;
  onBack: () => void;
};

export function AdminUserDetailPage({ enabled, userId, onBack }: AdminUserDetailPageProps) {
  const userQuery = useAdminUserDetailQuery(userId, enabled);
  const user = userQuery.data?.user;

  if (userQuery.isLoading || userQuery.isFetching) {
    return <LoadingState rows={6} />;
  }

  if (userQuery.error instanceof ApiError && userQuery.error.response.status === 404) {
    return (
      <EmptyState
        title="User not found"
        description="The requested dashboard user does not exist."
        action={
          <Button variant="light" onClick={onBack} leftSection={<ArrowLeft size={16} />}>
            Back to users list
          </Button>
        }
      />
    );
  }

  if (userQuery.isError || !user) {
    return (
      <ErrorState
        title="User could not be loaded"
        description="The selected user may not exist or the admin detail endpoint is unavailable."
        retryAction={
          <Group>
            <Button variant="light" onClick={onBack} leftSection={<ArrowLeft size={16} />}>
              Back to users list
            </Button>
            <Button variant="light" onClick={() => void userQuery.refetch()}>
              Retry
            </Button>
          </Group>
        }
      />
    );
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed user";

  return (
    <Stack gap="lg">
      <Button variant="subtle" onClick={onBack} leftSection={<ArrowLeft size={16} />} w="fit-content">
        Back to users list
      </Button>

      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={1} size="h2">
            {name}
          </Title>
          <Text c="dimmed" size="sm">
            {user.email}
          </Text>
        </Stack>
        <Badge variant="light" color={user.emailVerified ? "green" : "gray"}>
          {user.emailVerified ? "Verified email" : "Unverified email"}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder radius="sm" p="md">
          <Stack gap="md">
            <Title order={2} size="h3">
              User summary
            </Title>
            <Field label="Local user ID" value={user.id} />
            <Field label="First name" value={user.firstName} />
            <Field label="Last name" value={user.lastName} />
            <Field label="Role" value={user.role} />
            <Field label="Auth provider" value={user.authProvider} />
            <Field label="Created" value={formatDateTime(user.createdAt)} />
            <Field label="Updated" value={formatDateTime(user.updatedAt)} />
          </Stack>
        </Card>

        <Card withBorder radius="sm" p="md">
          <Stack gap="md">
            <Title order={2} size="h3">
              Company summary
            </Title>
            {user.company ? (
              <>
                <Field label="Company ID" value={user.company.id} />
                <Field label="Legal name" value={user.company.legalName} />
                <Field label="Display name" value={user.company.displayName} />
                <Field label="Company type" value={user.company.companyType} />
                <Field label="Primary contact" value={user.company.primaryContactName} />
                <Field label="Primary contact email" value={user.company.primaryContactEmail} />
                <Field label="Country" value={user.company.country} />
                <Field label="Status" value={user.company.status} />
              </>
            ) : (
              <Text c="dimmed" size="sm">
                This user has not created a company profile.
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" fw={700} tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{value || "Not provided"}</Text>
    </Stack>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
