import { Card, Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { AuthShell } from "../auth/AuthShell";
import styles from "./AppErrorShell.module.css";

type AppErrorShellProps = {
  title: string;
  description: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
};

export function AppErrorShell({
  title,
  description,
  primaryAction,
  secondaryAction
}: AppErrorShellProps) {
  return (
    <AuthShell>
      <Card withBorder radius="md" p="xl" className={styles.card}>
        <Stack gap="lg" align="flex-start">
          <Stack gap={8}>
            <Text className={styles.eyebrow}>RSL Collective Dashboard</Text>
            <Title order={1} size="h2" lh={1.1} className={styles.title}>
              {title}
            </Title>
            <Text size="sm" className={styles.description}>
              {description}
            </Text>
          </Stack>
          <Group gap="sm" className={styles.actions}>
            {primaryAction}
            {secondaryAction}
          </Group>
        </Stack>
      </Card>
    </AuthShell>
  );
}
