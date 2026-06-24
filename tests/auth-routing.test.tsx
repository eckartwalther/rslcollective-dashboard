import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { AppProviders } from "../src/app/providers";
import { appRoutes } from "../src/app/router";
import { AppErrorPage } from "../src/pages/AppErrorPage";
import { setClerkAuthState } from "./setup";

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

function mockDashboardFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) => {
      if (path === "/api/session") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              authenticated: true,
              isAdmin: false,
              user: {
                email: "jane@example.com",
                firstName: "Jane",
                lastName: "Publisher",
                role: "owner",
                hasCompany: true
              }
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          )
        );
      }

      if (path === "/api/company") {
        return Promise.resolve(
          new Response(JSON.stringify({ company: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    })
  );
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
