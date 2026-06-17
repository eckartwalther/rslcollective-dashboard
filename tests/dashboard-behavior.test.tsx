import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppProviders } from "../src/app/providers";
import { DashboardPage } from "../src/pages/DashboardPage";
import type { SessionResponse } from "../src/api/session";

type AuthenticatedSession = Extract<SessionResponse, { authenticated: true }>;

const company = {
  legalName: "Example Media Inc.",
  displayName: "Example Media",
  companyType: "Publisher",
  primaryContactName: "Jane Publisher",
  primaryContactEmail: "jane@example.com",
  billingContactEmail: null,
  country: "US",
  region: null,
  city: null,
  postalCode: null,
  addressLine1: null,
  addressLine2: null,
  description: null,
  status: "draft",
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z"
};

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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function mockDashboardFetch(session: SessionResponse, companyBody: unknown = { company }) {
  const fetchMock = vi.fn((path: string) => {
    if (path === "/api/session") {
      return Promise.resolve(jsonResponse(session));
    }

    if (path === "/api/company") {
      return Promise.resolve(jsonResponse(companyBody));
    }

    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDashboard() {
  render(
    <AppProviders>
      <DashboardPage />
    </AppProviders>
  );
}

describe("dashboard behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("displays the RSL Internet Collective logo and signed-in user email from session", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    const logo = await screen.findByRole("img", { name: "RSL Internet Collective" });

    expect(logo).toHaveAttribute("src", "/brand/rsl-internet-collective-logo.svg");
    expect(screen.queryByText("RSL Collective")).not.toBeInTheDocument();
    expect(screen.queryByText("Profile application")).not.toBeInTheDocument();
    expect(screen.getAllByText("jane@example.com").length).toBeGreaterThan(0);
  });

  it("does not render placeholder account data", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findAllByText("jane@example.com");
    expect(screen.queryByText("publisher@example.com")).not.toBeInTheDocument();
  });

  it("submits sign-out through a POST /logout form", async () => {
    mockDashboardFetch(authenticatedSession());
    const submitSpy = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);

    renderDashboard();

    const signOutButtons = await screen.findAllByRole("button", { name: /sign out/i });
    fireEvent.click(signOutButtons[0]);

    await waitFor(() => {
      const form = document.querySelector<HTMLFormElement>('form[action="/logout"]');

      expect(form).not.toBeNull();
      expect(form?.method).toBe("post");
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render WorkOS IDs, session IDs, or token hashes", async () => {
    mockDashboardFetch({
      authenticated: true,
      user: {
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Publisher",
        role: "owner",
        hasCompany: true
      }
    });

    renderDashboard();

    await screen.findAllByText("jane@example.com");
    const text = document.body.textContent ?? "";

    expect(text).not.toContain("workos_user");
    expect(text).not.toContain("ses_test");
    expect(text).not.toContain("token_hash");
  });

  it("lands on Dashboard home by default for a user with no company", async () => {
    mockDashboardFetch(
      authenticatedSession({
        hasCompany: false
      }),
      { company: null }
    );

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("Create your publisher profile")).toBeInTheDocument();
    expect(screen.getByText("Waiting for publisher profile")).toBeInTheDocument();
    expect(screen.getAllByText("Pending verification").length).toBeGreaterThan(0);
  });

  it("renders sidebar navigation and disabled approval-gated modules", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByRole("button", { name: /^Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Publisher Profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Company Profile/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Account Information/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Repertoire/i })).toHaveAttribute(
      "data-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: /^Licensee Exclusions/i })).toHaveAttribute(
      "data-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: /^Reporting/i })).toHaveAttribute(
      "data-disabled",
      "true"
    );
    expect(screen.queryByText("Requires approval")).not.toBeInTheDocument();
  });

  it("lets a user navigate from Dashboard to Publisher Profile and Account Information", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Publisher Profile/i }));

    expect(await screen.findByDisplayValue("Example Media Inc.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Account Information/i }));

    expect(await screen.findByText("Publisher role")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "RSL Internet Collective dashboard" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("shows company summary and approval-gated status cards for an existing company", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByText("Publisher summary")).toBeInTheDocument();
    expect(screen.getByText("Example Media Inc.")).toBeInTheDocument();
    expect(screen.getByText("Publisher verification: Pending review")).toBeInTheDocument();
    expect(screen.getAllByText("Pending review").length).toBeGreaterThan(0);
    expect(screen.getByText("Define your licensable content repertoire")).toBeInTheDocument();
    expect(screen.getByText("Manage licensee exclusions")).toBeInTheDocument();
    expect(screen.getByText("Review reporting activity")).toBeInTheDocument();
    expect(screen.getByText("Prepare enrollment readiness")).toBeInTheDocument();
    expect(screen.getByText("Set up licensing payments")).toBeInTheDocument();
    expect(screen.getAllByText("Pending approval").length).toBeGreaterThan(0);
  });

  it("does not use coming-soon language for verification-locked capabilities", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findByText("Publisher summary");

    expect(document.body.textContent ?? "").not.toMatch(/coming soon/i);
    expect(document.body.textContent ?? "").not.toContain(
      "Future modules are visible for orientation only. They are not configured yet."
    );
  });

  it("does not navigate when disabled approval-gated modules are clicked", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findByRole("heading", { name: "Dashboard" });
    const repertoireButton = screen.getByRole("button", { name: /^Repertoire/i });
    fireEvent.click(repertoireButton);

    expect(window.location.pathname).toBe("/dashboard");
  });

  it("does not make verification, payment, or gated-module API calls for static dashboard cards", async () => {
    const fetchMock = mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findByText("Publisher summary");
    const calledPaths = fetchMock.mock.calls.map(([path]) => path);

    expect(calledPaths).toEqual(expect.arrayContaining(["/api/session", "/api/company"]));
    expect(calledPaths).not.toContain("/api/verification");
    expect(calledPaths).not.toContain("/api/repertoire");
    expect(calledPaths).not.toContain("/api/reporting");
    expect(calledPaths).not.toContain("/api/licensee-exclusions");
    expect(calledPaths).not.toContain("/api/enrollment");
    expect(calledPaths).not.toContain("/api/payments");
  });
});
