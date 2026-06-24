import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from "../src/app/providers";
import { AuthRedirectPage } from "../src/pages/AuthRedirectPage";
import { DashboardPage } from "../src/pages/DashboardPage";
import { LoginPage } from "../src/pages/LoginPage";
import { RegisterPage } from "../src/pages/RegisterPage";
import { setClerkAuthState } from "./setup";

function renderRoutes(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <AuthRedirectPage /> },
      { path: "/dashboard/*", element: <DashboardPage /> },
      { path: "/login/*", element: <LoginPage /> },
      { path: "/register/*", element: <RegisterPage /> }
    ],
    {
      initialEntries: [initialPath]
    }
  );

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );

  return router;
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
    const router = renderRoutes("/");

    expect(await screen.findByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
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
