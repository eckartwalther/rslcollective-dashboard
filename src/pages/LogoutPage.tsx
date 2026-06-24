import { useAuth } from "@clerk/react";
import { Center, Loader } from "@mantine/core";
import { useEffect } from "react";

export function LogoutPage() {
  const { signOut } = useAuth();

  useEffect(() => {
    void signOut({ redirectUrl: "/login" });
  }, [signOut]);

  return (
    <Center mih="100vh">
      <Loader aria-label="Signing out" />
    </Center>
  );
}
