import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppProviders } from "../src/app/providers";
import { DashboardPage } from "../src/pages/DashboardPage";
import type { SessionResponse } from "../src/api/session";

type AuthenticatedSession = Extract<SessionResponse, { authenticated: true }>;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function authenticatedSession(overrides: Partial<AuthenticatedSession["user"]> = {}): SessionResponse {
  return {
    authenticated: true,
    user: {
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Publisher",
      role: "owner",
      hasCompany: true,
      ...overrides
    }
  };
}

function renderDashboard() {
  return render(
    <AppProviders>
      <DashboardPage />
    </AppProviders>
  );
}

function mockDashboardFetch(session: SessionResponse, company: unknown = { company: null }) {
  const fetchMock = vi.fn((path: string) => {
    if (path === "/api/session") {
      return Promise.resolve(jsonResponse(session));
    }

    if (path === "/api/company") {
      return Promise.resolve(jsonResponse(company));
    }

    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("dashboard session wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the real account email from /api/session", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect((await screen.findAllByText("jane@example.com")).length).toBeGreaterThan(0);
  });

  it("does not render the old placeholder account email", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findAllByText("jane@example.com");
    expect(screen.queryByText("publisher@example.com")).not.toBeInTheDocument();
  });

  it("shows the intended sign-in state when unauthenticated", async () => {
    mockDashboardFetch({ authenticated: false });

    renderDashboard();

    expect(await screen.findByRole("heading", { name: /sign in required/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("displays account name, role, and company state", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByText("Jane Publisher")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Account Information/i }));

    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("Exists")).toBeInTheDocument();
  });

  it("submits POST /logout from the sign-out button", async () => {
    mockDashboardFetch(authenticatedSession());
    const submitSpy = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);

    renderDashboard();

    const buttons = await screen.findAllByRole("button", { name: /sign out/i });
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      const form = document.querySelector<HTMLFormElement>('form[action="/logout"]');

      expect(form).not.toBeNull();
      expect(form?.method).toBe("post");
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });
  });
});
