import { SignUp, useAuth } from "@clerk/react";
import { Center, Loader } from "@mantine/core";
import { Navigate } from "react-router-dom";
import { useClerkAuthCopyMode } from "../app/providers";
import { AuthShell, clerkAuthAppearance } from "../components/auth/AuthShell";

export function RegisterPage() {
  const { isLoaded, isSignedIn } = useAuth();

  useClerkAuthCopyMode("signUp");

  if (!isLoaded) {
    return (
      <Center mih="100vh">
        <Loader aria-label="Loading session" />
      </Center>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AuthShell>
      <SignUp
        appearance={clerkAuthAppearance}
        routing="path"
        path="/register"
        signInUrl="/login"
        fallbackRedirectUrl="/dashboard"
      />
    </AuthShell>
  );
}
