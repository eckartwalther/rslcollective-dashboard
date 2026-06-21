import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  metadata?: ReactNode;
};

export function PageHeader({
  title,
  description,
  badge,
  actions,
  metadata
}: PageHeaderProps) {
  return (
    <Group justify="space-between" align="start" gap="md" wrap="wrap">
      <Stack gap={6} maw={740}>
        <Group gap="xs" align="center">
          <Title order={1} size="h2" lh={1.1}>
            {title}
          </Title>
          {badge}
        </Group>
        {typeof description === "string" ? (
          <Text c="dimmed" size="sm" maw={680}>
            {description}
          </Text>
        ) : description ? (
          description
        ) : (
          null
        )}
        {metadata ? (
          <Group gap="xs" mt={2} wrap="wrap">
            {metadata}
          </Group>
        ) : null}
      </Stack>
      {actions ? (
        <Group gap="xs" justify="flex-end">
          {actions}
        </Group>
      ) : null}
    </Group>
  );
}
