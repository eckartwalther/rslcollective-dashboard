import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from "../src/app/providers";
import { DashboardPage } from "../src/pages/DashboardPage";
import { LoginPage } from "../src/pages/LoginPage";
import type { SessionResponse } from "../src/api/session";
import { setClerkAuthState } from "./setup";

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

function renderDashboardRoute() {
  const router = createMemoryRouter(
    [
      { path: "/dashboard/*", element: <DashboardPage /> },
      { path: "/login/*", element: <LoginPage /> }
    ],
    {
      initialEntries: ["/dashboard"]
    }
  );

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );

  return router;
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

  it("redirects to Clerk sign-in when unauthenticated", async () => {
    setClerkAuthState({ isSignedIn: false });
    const router = renderDashboardRoute();

    expect(await screen.findByTestId("clerk-sign-in")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("displays account name, role, and company state", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByText("Jane Publisher")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Account Information/i }));

    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("Exists")).toBeInTheDocument();
  });

  it("signs out through Clerk from the sign-out button", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    const buttons = await screen.findAllByRole("button", { name: /sign out/i });
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(document.querySelector<HTMLFormElement>('form[action="/logout"]')).toBeNull();
    });
  });
});
