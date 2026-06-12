import { Box, Divider, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: number;
  withDivider?: boolean;
};

export function FormSection({
  title,
  description,
  children,
  maxWidth = 820,
  withDivider = true
}: FormSectionProps) {
  return (
    <Box maw={maxWidth} w="100%">
      <Stack gap="sm">
        {withDivider ? <Divider /> : null}
        <Stack gap={2}>
          <Title order={3} size="h5">
            {title}
          </Title>
          {description ? (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}
