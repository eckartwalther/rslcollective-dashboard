import { Button } from "@mantine/core";
import { Link } from "react-router-dom";
import { AppErrorShell } from "../components/error/AppErrorShell";

export function NotFoundPage() {
  return (
    <AppErrorShell
      title="Page not found"
      description="The page you requested does not exist or may have moved."
      primaryAction={
        <Button component={Link} to="/dashboard">
          Go to dashboard
        </Button>
      }
      secondaryAction={
        <Button component={Link} to="/login" variant="default">
          Sign in
        </Button>
      }
    />
  );
}
