import { Badge, Card, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type StatusColor = "blue" | "gray" | "green" | "yellow" | "orange" | "red";

type StatusCardProps = {
  title: string;
  status: string;
  description: string;
  icon: LucideIcon;
  color?: StatusColor;
  action?: ReactNode;
};

export function StatusCard({
  title,
  status,
  description,
  icon: Icon,
  color = "gray",
  action
}: StatusCardProps) {
  return (
    <Card withBorder radius="sm" p="md">
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color={color} size="lg" radius="sm">
              <Icon size={18} strokeWidth={1.8} />
            </ThemeIcon>
            <Title order={3} size="h5">
              {title}
            </Title>
          </Group>
          <Badge color={color} variant="light">
            {status}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
        {action}
      </Stack>
    </Card>
  );
}
