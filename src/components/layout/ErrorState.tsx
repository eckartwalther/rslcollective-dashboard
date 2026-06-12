import { Alert, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

type ErrorStateProps = {
  title: string;
  description: ReactNode;
  retryAction?: ReactNode;
};

export function ErrorState({ title, description, retryAction }: ErrorStateProps) {
  return (
    <Alert color="red" title={title} variant="light">
      <Stack gap="xs" align="flex-start">
        <Text size="sm">{description}</Text>
        {retryAction}
      </Stack>
    </Alert>
  );
}
