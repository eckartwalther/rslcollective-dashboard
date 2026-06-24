import { useAuth } from "@clerk/react";
import { Center, Loader } from "@mantine/core";
import { Navigate } from "react-router-dom";

export function AuthRedirectPage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <Center mih="100vh">
        <Loader aria-label="Loading session" />
      </Center>
    );
  }

  return <Navigate to={isSignedIn ? "/dashboard" : "/login"} replace />;
}
