import { Button } from "@mantine/core";
import { Link, useRouteError } from "react-router-dom";
import { useEffect } from "react";
import { AppErrorShell } from "../components/error/AppErrorShell";

export function AppErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    if (import.meta.env.DEV && error) {
      console.error("Route error", error);
    }
  }, [error]);

  return (
    <AppErrorShell
      title="Something went wrong"
      description="The dashboard could not load this page."
      primaryAction={
        <Button onClick={() => window.location.reload()}>
          Reload page
        </Button>
      }
      secondaryAction={
        <Button component={Link} to="/dashboard" variant="default">
          Go to dashboard
        </Button>
      }
    />
  );
}
