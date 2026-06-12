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

  it("displays the RSL Collective shell and signed-in user email from session", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "RSL Collective" })).toBeInTheDocument();
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
    expect(await screen.findByText("Create your company profile")).toBeInTheDocument();
    expect(screen.getByText("Only Company Profile is available in this phase.")).toBeInTheDocument();
  });

  it("renders sidebar navigation and disabled future modules", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByRole("button", { name: /^Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Company Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Account Information/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Repertoire/i })).toHaveAttribute("data-disabled", "true");
    expect(screen.getByRole("button", { name: /^Licensee Exclusions/i })).toHaveAttribute("data-disabled", "true");
    expect(screen.getByRole("button", { name: /^Reporting/i })).toHaveAttribute("data-disabled", "true");
  });

  it("lets a user navigate from Dashboard to Company Profile and Account Information", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Company Profile/i }));

    expect(await screen.findByDisplayValue("Example Media Inc.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Account Information/i }));

    expect(await screen.findByText("Company role")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("shows company summary and static future status cards for an existing company", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByText("Company summary")).toBeInTheDocument();
    expect(screen.getByText("Example Media Inc.")).toBeInTheDocument();
    expect(screen.getAllByText("Repertoire").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(screen.getByText("Next steps coming soon")).toBeInTheDocument();
  });

  it("does not make future-module API calls for static dashboard cards", async () => {
    const fetchMock = mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findByText("Company summary");
    const calledPaths = fetchMock.mock.calls.map(([path]) => path);

    expect(calledPaths).toEqual(expect.arrayContaining(["/api/session", "/api/company"]));
    expect(calledPaths).not.toContain("/api/repertoire");
    expect(calledPaths).not.toContain("/api/reporting");
    expect(calledPaths).not.toContain("/api/licensee-exclusions");
  });
});
