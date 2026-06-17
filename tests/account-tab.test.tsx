import { fireEvent, render, screen } from "@testing-library/react";
import { AppProviders } from "../src/app/providers";
import { AccountTab } from "../src/components/dashboard/AccountTab";
import type { SessionUser } from "../src/api/session";

const userWithCompany: SessionUser = {
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Publisher",
  role: "owner",
  hasCompany: true
};

function renderAccountTab(user: SessionUser = userWithCompany, onSignOut = vi.fn()) {
  render(
    <AppProviders>
      <AccountTab user={user} onSignOut={onSignOut} />
    </AppProviders>
  );

  return { onSignOut };
}

describe("AccountTab", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("displays email from the session", () => {
    renderAccountTab();

    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("displays full name when firstName and lastName are available", () => {
    renderAccountTab();

    expect(screen.getByText("Jane Publisher")).toBeInTheDocument();
  });

  it("handles missing name cleanly", () => {
    renderAccountTab({
      ...userWithCompany,
      firstName: null,
      lastName: null
    });

    expect(screen.queryByText(/^Name$/)).not.toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("displays publisher role", () => {
    renderAccountTab();

    expect(screen.getByText("Publisher role")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("displays whether a publisher profile exists", () => {
    renderAccountTab();

    expect(screen.getByText("Publisher profile")).toBeInTheDocument();
    expect(screen.getByText("Exists")).toBeInTheDocument();

    renderAccountTab({
      ...userWithCompany,
      email: "new@example.com",
      hasCompany: false
    });

    expect(screen.getByText("Not created")).toBeInTheDocument();
  });

  it("calls the sign-out handler", () => {
    const { onSignOut } = renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows a destructive account deletion request section", () => {
    renderAccountTab();

    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByText(/publisher profile associated with it/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
  });

  it("explains account deletion is a support request and does not call a delete API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(screen.getByText("Account deletion request")).toBeInTheDocument();
    expect(screen.getByText(/handled by RSL Collective support/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
