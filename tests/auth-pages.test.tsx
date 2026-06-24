import { render, screen } from "@testing-library/react";
import authShellSource from "../src/components/auth/AuthShell.tsx?raw";
import providersSource from "../src/app/providers.tsx?raw";
import { LoginPage } from "../src/pages/LoginPage";
import { RegisterPage } from "../src/pages/RegisterPage";
import { setClerkAuthState } from "./setup";

describe("Clerk auth pages", () => {
  it("renders the simplified branded login page around Clerk SignIn", () => {
    setClerkAuthState({ isSignedIn: false });

    render(<LoginPage />);

    expect(screen.getAllByAltText("RSL Internet Collective")).toHaveLength(1);
    expect(screen.queryByText(/dashboard access/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
  });

  it("renders the simplified branded register page around Clerk SignUp", () => {
    setClerkAuthState({ isSignedIn: false });

    render(<RegisterPage />);

    expect(screen.getAllByAltText("RSL Internet Collective")).toHaveLength(1);
    expect(screen.queryByText(/dashboard access/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument();
  });

  it("does not render the old split-panel marketing copy", () => {
    setClerkAuthState({ isSignedIn: false });

    render(<LoginPage />);

    expect(screen.queryByText(/access your rsl internet collective workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/company profile tools for member publishers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secure access for verified dashboard users/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/use your approved email address/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
  });

  it("configures Clerk-owned titles through localization", () => {
    expect(providersSource).toContain("Sign in to your account");
    expect(providersSource).toContain("Create your RSL Collective account");
  });

  it("configures Clerk-owned social button copy by auth route", () => {
    expect(providersSource).toContain("Sign in with {{provider|titleize}}");
    expect(providersSource).toContain("Sign up with {{provider|titleize}}");
  });

  it("keeps the default Clerk card width while stacking social buttons", () => {
    expect(authShellSource).not.toContain("width: \"min(100%, 520px)\"");
    expect(authShellSource).toContain("gridTemplateColumns: \"1fr\"");
    expect(authShellSource).toContain("socialButtonsBlockButton");
  });
});
