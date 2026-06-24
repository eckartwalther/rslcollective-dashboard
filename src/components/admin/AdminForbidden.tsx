import { Alert, Button, Stack, Text } from "@mantine/core";

type AdminForbiddenProps = {
  onBackToDashboard: () => void;
};

export function AdminForbidden({ onBackToDashboard }: AdminForbiddenProps) {
  return (
    <Alert color="red" title="Admin access required" variant="light">
      <Stack gap="xs" align="flex-start">
        <Text size="sm">
          Your account is signed in, but it is not approved for the dashboard admin area.
        </Text>
        <Button variant="light" color="red" onClick={onBackToDashboard}>
          Back to dashboard
        </Button>
      </Stack>
    </Alert>
  );
}
