import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const removedSummaryLabel = ["Onboarding", "summary"].join(" ");
const staticPublisherProfileBody =
  "Add your publisher information so the RSL Collective can review your organization and prepare your account for licensing.";

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
  beforeEach(() => {
    window.history.pushState(null, "", "/dashboard");
  });

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
    expect(screen.getByText("License your content and receive royalties through the RSL Collective")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Create publisher profile" })
    ).toBeInTheDocument();
    const gettingStartedCard = screen.getByTestId("dashboard-getting-started-card");

    expect(within(gettingStartedCard).getByText(staticPublisherProfileBody)).toBeInTheDocument();
    expect(within(gettingStartedCard).getByText("Create your publisher profile.")).toBeInTheDocument();
    expect(
      within(gettingStartedCard).getByText(
        "Prepare RSL declarations for the content you want to license."
      )
    ).toBeInTheDocument();
    expect(within(gettingStartedCard).getByText("Publish RSL files and link them from robots.txt.")).toBeInTheDocument();
    expect(
      within(gettingStartedCard).getByText(
        "Enroll each participating website or subdomain root after publisher verification and licensing review."
      )
    ).toBeInTheDocument();
    expect(
      within(gettingStartedCard).getByText(
        "Keep RSL files and enrollment information current as content, rights, and licensing boundaries change."
      )
    ).toBeInTheDocument();
    expect(
      within(gettingStartedCard).getByRole("button", { name: "Dismiss getting started" })
    ).toBeInTheDocument();
    expect(
      within(gettingStartedCard).queryByRole("button", { name: "Create publisher profile" })
    ).not.toBeInTheDocument();
    expect(
      within(gettingStartedCard).queryByRole("link", { name: /Read onboarding guide/i })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Create publisher profile" }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("dashboard-define-profile-action")).toHaveAttribute(
      "data-dashboard-action",
      "compact"
    );
    expect(screen.getByTestId("dashboard-verify-profile-action")).toHaveAttribute(
      "data-dashboard-action",
      "compact"
    );
    expect(screen.getByTestId("dashboard-verify-profile-action")).toBeDisabled();
    expect(screen.getAllByText("Pending verification").length).toBeGreaterThan(0);
  });

  it("dismisses the Getting started card without making an API call", async () => {
    const fetchMock = mockDashboardFetch(
      authenticatedSession({
        hasCompany: false
      }),
      { company: null }
    );

    renderDashboard();

    const card = await screen.findByTestId("dashboard-getting-started-card");
    const callCountBeforeDismiss = fetchMock.mock.calls.length;

    fireEvent.click(within(card).getByRole("button", { name: "Dismiss getting started" }));

    expect(screen.queryByTestId("dashboard-getting-started-card")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(callCountBeforeDismiss);
  });

  it("routes the profile action card button to the Publisher Profile view", async () => {
    mockDashboardFetch(
      authenticatedSession({
        hasCompany: false
      }),
      { company: null }
    );

    renderDashboard();

    fireEvent.click(await screen.findByTestId("dashboard-define-profile-action"));

    expect(window.location.pathname).toBe("/dashboard/company");
    expect(await screen.findByLabelText(/^Legal company name/i)).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /^Publisher Verification/i })).toHaveAttribute(
      "data-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: /^Enrollment/i })).toHaveAttribute(
      "data-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: /^Licensing Payments/i })).toHaveAttribute(
      "data-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: /^Review Licensing Terms/i })).toHaveAttribute(
      "data-disabled",
      "true"
    );
    const settingsButton = screen.getByRole("button", { name: /^Settings/i });
    const onboardingLink = screen.getByRole("link", { name: /^Onboarding Guide/i });
    const divider = screen.getByTestId("onboarding-guide-divider");
    const navigation = screen.getByTestId("dashboard-navigation");
    const navLabels = Array.from(navigation.children).map((child) =>
      child.textContent?.replace(/\s+/g, " ").trim()
    );

    expect(navigation).toContainElement(onboardingLink);
    expect(navLabels).toEqual([
      "Dashboard",
      "Publisher Profile",
      "Publisher Verification",
      "Repertoire",
      "Licensee Exclusions",
      "Reporting",
      "Enrollment",
      "Licensing Payments",
      "Review Licensing Terms",
      "Account Information",
      "Settings",
      "",
      "Onboarding Guide"
    ]);
    expect(onboardingLink).toHaveAttribute("data-testid", "dashboard-help-navigation");
    expect(onboardingLink).toHaveAttribute("href", "/dashboard/onboarding");
    expect(onboardingLink).not.toHaveAttribute("target");
    expect(onboardingLink).not.toHaveAttribute("rel");
    expect(onboardingLink).not.toHaveTextContent("Opens in a new tab");
    expect(divider.previousElementSibling).toBe(settingsButton);
    expect(divider.nextElementSibling).toBe(onboardingLink);
    expect(
      settingsButton.compareDocumentPosition(onboardingLink) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      settingsButton.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      divider.compareDocumentPosition(onboardingLink) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByText("Requires approval")).not.toBeInTheDocument();
  });

  it("lets a user navigate from Dashboard to Publisher Profile and Account Information", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Publisher Profile/i }));

    expect(await screen.findByDisplayValue("Example Media Inc.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Account Information/i }));

    expect(await screen.findByText("Account role")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "RSL Internet Collective dashboard" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("shows submitted profile copy and operational status cards for an existing company", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Create publisher profile" })
    ).toBeInTheDocument();
    const gettingStartedCard = screen.getByTestId("dashboard-getting-started-card");

    expect(within(gettingStartedCard).getByText(staticPublisherProfileBody)).toBeInTheDocument();
    expect(
      within(gettingStartedCard).queryByRole("button", { name: "Edit publisher profile" })
    ).not.toBeInTheDocument();
    expect(
      within(gettingStartedCard).queryByRole("link", { name: /Read onboarding guide/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Publisher profile submitted")).not.toBeInTheDocument();
    expect(screen.queryByText("Example Media Inc.")).not.toBeInTheDocument();
    expect(screen.getByText("Create profile")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit publisher profile" }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("dashboard-define-profile-action")).toHaveAttribute(
      "data-dashboard-action",
      "compact"
    );
    expect(screen.getByTestId("dashboard-verify-profile-action")).toHaveAttribute(
      "data-dashboard-action",
      "compact"
    );
    expect(screen.getByText("Complete verification")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-verify-profile-action")).toBeDisabled();
    expect(screen.getByText("Accept licensing terms")).toBeInTheDocument();
    expect(screen.getByText("Review and agree to the RSL Collective licensing terms.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept licensing terms" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Accept licensing terms" })).not.toBeInTheDocument();
    expect(screen.getByText("Register content")).toBeInTheDocument();
    expect(screen.getByText("Exclude licensees")).toBeInTheDocument();
    expect(screen.getByText("View reports")).toBeInTheDocument();
    expect(screen.getByText("Set up payments")).toBeInTheDocument();
    expect(screen.getAllByText("Pending verification").length).toBeGreaterThan(0);
  });

  it("does not use prohibited dashboard home phrases", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findByRole("heading", { name: "Create publisher profile" });

    const text = document.body.textContent ?? "";

    expect(text).not.toMatch(/disabled/i);
    expect(text).not.toMatch(/coming soon/i);
    expect(text).not.toMatch(/future module/i);
    expect(text).not.toMatch(/not configured yet/i);
    expect(text).not.toMatch(/once enabled/i);
    expect(text).not.toMatch(/locked until/i);
    expect(text).not.toMatch(/next steps/i);
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

    await screen.findByRole("heading", { name: "Create publisher profile" });
    fireEvent.click(screen.getByRole("button", { name: "Verify profile" }));

    expect(window.location.pathname).toBe("/dashboard");

    const calledPaths = fetchMock.mock.calls.map(([path]) => path);

    expect(calledPaths).toEqual(expect.arrayContaining(["/api/session", "/api/company"]));
    expect(calledPaths).not.toContain("/api/verification");
    expect(calledPaths).not.toContain("/api/repertoire");
    expect(calledPaths).not.toContain("/api/reporting");
    expect(calledPaths).not.toContain("/api/licensee-exclusions");
    expect(calledPaths).not.toContain("/api/enrollment");
    expect(calledPaths).not.toContain("/api/payments");
    expect(calledPaths).not.toContain("/api/licensing-terms");
  });

  it("renders the static onboarding guide without new API calls", async () => {
    const fetchMock = mockDashboardFetch(authenticatedSession());
    window.history.pushState(null, "", "/dashboard/onboarding");

    renderDashboard();

    expect(await screen.findByTestId("onboarding-doc-layout", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Onboarding Guide");
    expect(screen.getByTestId("onboarding-article-body")).toBeInTheDocument();
    expect(screen.queryByText(removedSummaryLabel)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(removedSummaryLabel);
    expect(
      screen.getByRole("heading", { name: "Step 1: Define RSL declarations" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Step 2: Publish RSL declarations for your content through robots.txt"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Step 3: Enroll your websites or subdomains in the RSL Collective"
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Step 4: Readiness checklist" })).toBeInTheDocument();
    expect(screen.getAllByText(/https:\/\/rslcollective\.org\/license/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Last updated:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lastUpdated:\s*true/)).not.toBeInTheDocument();
    expect(screen.queryByText(/outline:\s*\[2,3\]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\{2\}/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("xml example").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("html example").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("text example").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/License: https:\/\/example\.com\/rsl\.xml/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /RSL Collective licensing uses a web-native declaration and enrollment model/
      )
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("onboarding-article-list").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("onboarding-article-paragraph").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("onboarding-code-block").length).toBeGreaterThan(0);

    const calledPaths = fetchMock.mock.calls.map(([path]) => path);

    expect(calledPaths).toEqual(expect.arrayContaining(["/api/session", "/api/company"]));
    expect(calledPaths).not.toContain("/api/onboarding");
    expect(calledPaths).not.toContain("/api/enrollment");
    expect(calledPaths).not.toContain("/api/robots");
    expect(calledPaths).not.toContain("/api/rsl");
  });

  it("does not render a Dashboard home onboarding guide action", async () => {
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    await screen.findByRole("heading", { name: "Dashboard" });

    expect(screen.queryByRole("link", { name: /Read onboarding guide/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Read onboarding guide/i })).not.toBeInTheDocument();
  });

  it("renders /dashboard/onboarding as an authenticated static dashboard view", async () => {
    window.history.pushState(null, "", "/dashboard/onboarding");
    mockDashboardFetch(authenticatedSession());

    renderDashboard();

    expect(await screen.findByTestId("onboarding-doc-layout", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Onboarding Guide");
    expect(
      screen.getByText(
        /This guide helps publishers prepare their content for licensing through the RSL Collective/
      )
    ).toBeInTheDocument();
  });
});
