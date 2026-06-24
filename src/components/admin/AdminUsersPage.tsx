import {
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  Stack,
  Table,
  Text,
  Title
} from "@mantine/core";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminUsersQuery, type AdminUserListItem } from "../../api/admin";
import { EmptyState } from "../layout/EmptyState";
import { ErrorState } from "../layout/ErrorState";
import { LoadingState } from "../layout/LoadingState";

const pageSize = 25;

type AdminUsersPageProps = {
  enabled: boolean;
  onSelectUser: (userId: string) => void;
};

export function AdminUsersPage({ enabled, onSelectUser }: AdminUsersPageProps) {
  const [page, setPage] = useState(() => pageFromLocation());
  const usersQuery = useAdminUsersQuery(page, pageSize, enabled);
  const users = usersQuery.data?.users ?? [];
  const totalPages = usersQuery.data?.totalPages ?? 0;

  useEffect(() => {
    const handlePopState = () => setPage(pageFromLocation());

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (usersQuery.isLoading || usersQuery.isFetching) {
    return <LoadingState rows={8} />;
  }

  if (usersQuery.isError) {
    return (
      <ErrorState
        title="Users could not be loaded"
        description="The admin users list is unavailable right now."
        retryAction={
          <Button variant="light" onClick={() => void usersQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Title order={1} size="h2">
            Admin users
          </Title>
          <Text c="dimmed" size="sm">
            Registered local dashboard users, newest first.
          </Text>
        </Stack>
        <Badge variant="light" color="blue">
          {usersQuery.data?.total ?? 0} total
        </Badge>
      </Group>

      {users.length === 0 ? (
        <EmptyState
          title="No registered users"
          description="Local dashboard users will appear here after they sign in."
        />
      ) : (
        <Card withBorder radius="sm" p={0}>
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Company</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th aria-label="Open user" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} onSelectUser={onSelectUser} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      {totalPages > 1 ? (
        <Group justify="flex-end">
          <Pagination
            value={page}
            total={totalPages}
            onChange={(nextPage) => {
              setPage(nextPage);
              const nextUrl = nextPage === 1 ? "/admin/users" : `/admin/users?page=${nextPage}`;
              window.history.pushState(null, "", nextUrl);
            }}
          />
        </Group>
      ) : null}
    </Stack>
  );
}

function UserRow({
  user,
  onSelectUser
}: {
  user: AdminUserListItem;
  onSelectUser: (userId: string) => void;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed user";

  return (
    <Table.Tr
      role="link"
      tabIndex={0}
      aria-label={`Open ${name}`}
      style={{ cursor: "pointer" }}
      onClick={() => onSelectUser(user.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectUser(user.id);
        }
      }}
    >
      <Table.Td>
        <Text fw={600} size="sm">
          {name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{user.email}</Text>
      </Table.Td>
      <Table.Td>
        <Text c={user.companyLegalName ? undefined : "dimmed"} size="sm">
          {user.companyLegalName ?? "No company"}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{formatDate(user.createdAt)}</Text>
      </Table.Td>
      <Table.Td>
        <ChevronRight size={16} aria-hidden />
      </Table.Td>
    </Table.Tr>
  );
}

function pageFromLocation() {
  const value = new URLSearchParams(window.location.search).get("page");
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}
