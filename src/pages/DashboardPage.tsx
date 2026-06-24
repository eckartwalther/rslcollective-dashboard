import { useAuth } from "@clerk/react";
import { Center, Loader } from "@mantine/core";
import { Navigate } from "react-router-dom";
import { useSessionQuery } from "../api/session";
import { DashboardShell } from "../components/layout/DashboardShell";

export function DashboardPage() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const sessionQuery = useSessionQuery();

  if (!isLoaded || (isSignedIn && sessionQuery.isLoading)) {
    return (
      <Center mih="100vh">
        <Loader aria-label="Loading session" />
      </Center>
    );
  }

  if (!isSignedIn || !sessionQuery.data?.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardShell
      user={sessionQuery.data.user}
      onSignOut={() => {
        void signOut({ redirectUrl: "/login" });
      }}
    />
  );
}
