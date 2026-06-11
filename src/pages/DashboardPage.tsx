import { Button, Center, Container, Loader, Stack, Text, Title } from "@mantine/core";
import { signOut, useSessionQuery } from "../api/session";
import { DashboardShell } from "../components/layout/DashboardShell";

export function DashboardPage() {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isLoading) {
    return (
      <Center mih="100vh">
        <Loader aria-label="Loading session" />
      </Center>
    );
  }

  if (!sessionQuery.data?.authenticated) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Title order={1}>Sign in required</Title>
          <Text c="dimmed">Please sign in to access the RSL Collective dashboard.</Text>
          <Button component="a" href="/login" w="fit-content">
            Sign in
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <DashboardShell
      user={sessionQuery.data.user}
      onSignOut={signOut}
    />
  );
}
