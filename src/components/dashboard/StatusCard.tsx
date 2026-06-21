import { Badge, Card, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./DashboardHome.module.css";

type StatusColor = "blue" | "gray" | "green" | "yellow" | "orange" | "red";
export type WorkflowCardState =
  | "available"
  | "complete"
  | "error"
  | "not-started"
  | "pending-profile"
  | "pending-verification";

type StatusCardProps = {
  title: string;
  status: string;
  description: string;
  icon: LucideIcon;
  color?: StatusColor;
  cardState?: WorkflowCardState;
  accentColor?: string;
  action?: ReactNode;
};

export function StatusCard({
  title,
  status,
  description,
  icon: Icon,
  color = "gray",
  cardState = "pending-verification",
  accentColor = "var(--mantine-color-gray-4)",
  action
}: StatusCardProps) {
  return (
    <Card
      withBorder
      radius="sm"
      p="md"
      className={styles.workflowCard}
      data-card-state={cardState}
      style={{ "--card-accent-color": accentColor } as CSSProperties}
    >
      <Stack gap="md" h="100%">
        <Group
          justify="space-between"
          align="flex-start"
          wrap="nowrap"
          className={styles.workflowCardHeader}
        >
          <Group gap="sm" wrap="nowrap" className={styles.workflowHeadingGroup}>
            <ThemeIcon
              variant="light"
              color={color}
              size="lg"
              radius="sm"
              className={styles.workflowIcon}
            >
              <Icon size={18} strokeWidth={1.8} />
            </ThemeIcon>
            <Title order={3} size="h5" className={styles.workflowTitle}>
              {title}
            </Title>
          </Group>
          <Badge color={color} variant="light" className={styles.statusBadge}>
            {status}
          </Badge>
        </Group>
        <Text size="sm" className={styles.workflowDescription}>
          {description}
        </Text>
        {action}
      </Stack>
    </Card>
  );
}
