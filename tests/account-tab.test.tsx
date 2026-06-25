import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppProviders } from "../src/app/providers";
import { AccountTab } from "../src/components/dashboard/AccountTab";
import type { SessionUser } from "../src/api/session";
import { clerkSignOutMock } from "./setup";

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

  it("displays account role", () => {
    renderAccountTab();

    expect(screen.getByText("Account role")).toBeInTheDocument();
    expect(screen.queryByText("Publisher role")).not.toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("displays whether a publisher profile exists", () => {
    renderAccountTab();

    expect(screen.getByText("Publisher profile")).toBeInTheDocument();
    expect(screen.getByText("Exists")).toBeInTheDocument();
    expect(screen.queryByText("Publisher profile complete")).not.toBeInTheDocument();

    renderAccountTab({
      ...userWithCompany,
      email: "new@example.com",
      hasCompany: false
    });

    expect(screen.getByText("Not created")).toBeInTheDocument();
    expect(screen.queryByText("Publisher profile needed")).not.toBeInTheDocument();
  });

  it("calls the sign-out handler", () => {
    const { onSignOut } = renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows a destructive account deletion request section", () => {
    renderAccountTab();

    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByText("Deleting your account is permanent and cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
  });

  it("opens the account deletion confirmation modal", () => {
    renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    expect(screen.getByRole("dialog", { name: "Delete account?" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Deleting your account will permanently delete your RSL Collective account and sign you out. This action cannot be undone."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
  });

  it("closes the account deletion modal on cancel without calling the delete API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete account?" })).not.toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls DELETE /api/account only after confirmation", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ deleted: true }));
    vi.stubGlobal("fetch", fetchMock);
    renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));

    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/account",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.any(Headers)
        })
      );
    });
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = firstCall[1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-clerk-token");
  });

  it("redirects to the signed-out deleted-account state on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ deleted: true })));
    renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    await waitFor(() => {
      expect(clerkSignOutMock).toHaveBeenCalledWith({ redirectUrl: "/login?deleted=1" });
    });
  });

  it("shows a clear error and does not redirect when account deletion fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "server_error",
              message: "Your account could not be deleted."
            }
          },
          500
        )
      )
    );
    renderAccountTab();

    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByText("Account could not be deleted")).toBeInTheDocument();
    expect(screen.getByText(/Please try again or contact RSL Collective support/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete account?" })).toBeInTheDocument();
    expect(clerkSignOutMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
