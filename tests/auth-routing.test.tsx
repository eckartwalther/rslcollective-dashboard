import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { AppProviders } from "../src/app/providers";
import { appRoutes } from "../src/app/router";
import { AppErrorPage } from "../src/pages/AppErrorPage";
import { setClerkAuthState } from "./setup";

const nonAdminSession = {
  authenticated: true,
  isAdmin: false,
  user: {
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Publisher",
    role: "owner",
    hasCompany: true
  }
};

const adminSession = {
  authenticated: true,
  isAdmin: true,
  user: {
    email: "eckart@rslcollective.org",
    firstName: "Eckart",
    lastName: "Admin",
    role: "owner",
    hasCompany: true
  }
};

function renderRoutes(initialPath: string, routes: RouteObject[] = appRoutes) {
  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath]
  });

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );

  return router;
}

function BrokenRoute(): null {
  throw new Error("private route failure");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function mockDashboardFetch(
  session: unknown = nonAdminSession,
  extraResponses: Record<string, Response | Promise<Response>> = {}
) {
  const fetchMock = vi.fn((path: string) => {
    if (path === "/api/session") {
      return Promise.resolve(jsonResponse(session));
    }

    if (path === "/api/company") {
      return Promise.resolve(jsonResponse({ company: null }));
    }

    if (path in extraResponses) {
      return Promise.resolve(extraResponses[path]);
    }

    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Clerk auth routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("/ redirects signed-out users to /login", async () => {
    setClerkAuthState({ isSignedIn: false });
    const fetchMock = vi.fn(() => Promise.reject(new Error("signed-out root must not call APIs")));
    vi.stubGlobal("fetch", fetchMock);
    const router = renderRoutes("/");

    expect(await screen.findByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("/ redirects signed-in users to /dashboard", async () => {
    setClerkAuthState({ isSignedIn: true });
    mockDashboardFetch();
    const router = renderRoutes("/");

    expect((await screen.findAllByText("Jane Publisher")).length).toBeGreaterThan(0);
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
  });

  it("/dashboard redirects signed-out users to /login", async () => {
    setClerkAuthState({ isSignedIn: false });
    const router = renderRoutes("/dashboard");

    expect(await screen.findByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("/admin/users routes through the authenticated dashboard shell", async () => {
    setClerkAuthState({ isSignedIn: true });
    window.history.pushState(null, "", "/admin/users");
    mockDashboardFetch();
    const router = renderRoutes("/admin/users");

    expect(await screen.findByText("Admin access required")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/users");
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  });

  it("/admin/users renders the admin users page for an admin", async () => {
    setClerkAuthState({ isSignedIn: true });
    window.history.pushState(null, "", "/admin/users");
    mockDashboardFetch(adminSession, {
      "/api/admin/users?page=1&pageSize=25": jsonResponse({
        users: [
          {
            id: "usr_admin_target",
            email: "target@example.com",
            firstName: "Target",
            lastName: "User",
            authProvider: "clerk",
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
            companyId: null,
            companyLegalName: null
          }
        ],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1
      })
    });

    const router = renderRoutes("/admin/users");

    expect(await screen.findByRole("heading", { name: "Admin users" })).toBeInTheDocument();
    expect(screen.getByText("target@example.com")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/users");
  });

  it("/admin/users/:id renders the admin user detail page for an admin", async () => {
    setClerkAuthState({ isSignedIn: true });
    window.history.pushState(null, "", "/admin/users/usr_admin_target");
    mockDashboardFetch(adminSession, {
      "/api/admin/users/usr_admin_target": jsonResponse({
        user: {
          id: "usr_admin_target",
          email: "target@example.com",
          firstName: "Target",
          lastName: "User",
          authProvider: "clerk",
          emailVerified: true,
          role: "owner",
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z",
          companyId: null,
          companyLegalName: null,
          company: null
        }
      })
    });

    const router = renderRoutes("/admin/users/usr_admin_target");

    expect(await screen.findByRole("heading", { name: "Target User" })).toBeInTheDocument();
    expect(screen.getByText("target@example.com")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/users/usr_admin_target");
  });

  it("/admin/users/:id renders a clean not found state when the user does not exist", async () => {
    setClerkAuthState({ isSignedIn: true });
    window.history.pushState(null, "", "/admin/users/usr_missing");
    mockDashboardFetch(adminSession, {
      "/api/admin/users/usr_missing": jsonResponse(
        {
          error: {
            code: "not_found",
            message: "User not found."
          }
        },
        404
      )
    });

    const router = renderRoutes("/admin/users/usr_missing");

    expect(await screen.findByText("User not found")).toBeInTheDocument();
    expect(screen.getByText("The requested dashboard user does not exist.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/users/usr_missing");
  });

  it.each(["/admin/usersss", "/admin/foo"])(
    "%s renders the branded not found page without admin API calls",
    async (path) => {
      setClerkAuthState({ isSignedIn: true });
      const fetchMock = vi.fn(() => Promise.reject(new Error("invalid admin routes must not fetch APIs")));
      vi.stubGlobal("fetch", fetchMock);
      const router = renderRoutes(path);

      expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
      expect(screen.getByText("The page you requested does not exist or may have moved.")).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("/nonexistent-route renders the branded not found page", async () => {
    setClerkAuthState({ isSignedIn: false });
    const router = renderRoutes("/nonexistent-route");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("The page you requested does not exist or may have moved.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(router.state.location.pathname).toBe("/nonexistent-route");
    expect(screen.queryByText(/unexpected application error/i)).not.toBeInTheDocument();
  });

  it("/auth/callback renders the branded not found page without old auth callback copy", async () => {
    setClerkAuthState({ isSignedIn: false });
    renderRoutes("/auth/callback?code=test");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.queryByText(/authentication could not be completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign-in link expired/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/click here to log in/i)).not.toBeInTheDocument();
  });

  it("renders the branded route error page instead of React Router default copy", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderRoutes("/broken", [
      {
        path: "/broken",
        element: <BrokenRoute />,
        errorElement: <AppErrorPage />
      }
    ]);

    expect(await screen.findByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("The dashboard could not load this page.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByText(/unexpected application error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/private route failure/i)).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("/login redirects signed-in users to /dashboard", async () => {
    setClerkAuthState({ isSignedIn: true });
    mockDashboardFetch();
    const router = renderRoutes("/login");

    expect((await screen.findAllByText("Jane Publisher")).length).toBeGreaterThan(0);
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
  });

  it("/register redirects signed-in users to /dashboard", async () => {
    setClerkAuthState({ isSignedIn: true });
    mockDashboardFetch();
    const router = renderRoutes("/register");

    expect((await screen.findAllByText("Jane Publisher")).length).toBeGreaterThan(0);
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
  });

  it("does not show the old signed-out interstitial on the root route", async () => {
    setClerkAuthState({ isSignedIn: false });
    renderRoutes("/");

    expect(await screen.findByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(screen.queryByText(/click here to log in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in required/i)).not.toBeInTheDocument();
  });
});
