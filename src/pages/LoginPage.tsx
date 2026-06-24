import { SignIn, useAuth } from "@clerk/react";
import { Center, Loader } from "@mantine/core";
import { Navigate } from "react-router-dom";
import { useClerkAuthCopyMode } from "../app/providers";
import { AuthShell, clerkAuthAppearance } from "../components/auth/AuthShell";

export function LoginPage() {
  const { isLoaded, isSignedIn } = useAuth();

  useClerkAuthCopyMode("signIn");

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
      <SignIn
        appearance={clerkAuthAppearance}
        routing="path"
        path="/login"
        signUpUrl="/register"
        fallbackRedirectUrl="/dashboard"
      />
    </AuthShell>
  );
}
