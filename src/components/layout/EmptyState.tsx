import { Alert, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Alert color="gray" title={title} variant="light">
      <Stack gap="xs" align="flex-start">
        <Text size="sm">{description}</Text>
        {action}
      </Stack>
    </Alert>
  );
}
