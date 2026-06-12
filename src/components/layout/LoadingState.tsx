import { Card, Group, Skeleton, Stack } from "@mantine/core";

type LoadingStateProps = {
  rows?: number;
};

export function LoadingState({ rows = 4 }: LoadingStateProps) {
  return (
    <Card withBorder radius="sm" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Skeleton height={18} width="32%" />
          <Skeleton height={22} width={96} radius="xl" />
        </Group>
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} height={18} width={index % 2 === 0 ? "100%" : "78%"} />
        ))}
      </Stack>
    </Card>
  );
}
