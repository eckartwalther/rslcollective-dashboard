import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { AppProviders } from "../src/app/providers";
import { CompanyProfileTab } from "../src/components/dashboard/CompanyProfileTab";
import { CompanyProfileForm } from "../src/components/forms/CompanyProfileForm";
import { DashboardPage } from "../src/pages/DashboardPage";
import { companyTypeValues } from "../src/schemas/company";

const existingCompany = {
  legalName: "Example Media Inc.",
  displayName: "Example Media",
  companyType: "Publisher",
  primaryContactName: "Jane Publisher",
  primaryContactEmail: "jane@example.com",
  billingContactEmail: "billing@example.com",
  country: "US",
  region: "CA",
  city: "Los Angeles",
  postalCode: "90001",
  addressLine1: "123 Main Street",
  addressLine2: "Suite 100",
  description: "Independent publisher.",
  status: "draft",
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function renderWithProviders(ui: ReactElement) {
  return render(<AppProviders>{ui}</AppProviders>);
}

function fillValidProfile(overrides: Record<string, string> = {}) {
  const values = {
    "Legal company name": "Example Media Inc.",
    "Primary contact name": "Jane Publisher",
    "Primary contact email": "jane@example.com",
    Country: "us",
    ...overrides
  };

  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`, "i")), {
      target: { value }
    });
  }
}

function readLastJsonBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

function getInputByLabel(label: RegExp) {
  const input = screen
    .getAllByLabelText(label)
    .find((element) => element instanceof HTMLInputElement);

  if (!input) {
    throw new Error(`Input not found for label ${label.toString()}`);
  }

  return input;
}

describe("CompanyProfileForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows an empty-state message for a no-company user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ company: null })));

    renderWithProviders(<CompanyProfileTab authenticated />);

    expect(await screen.findByText(/no company profile has been created yet/i)).toBeInTheDocument();
  });

  it("shows an editable form for a no-company user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ company: null })));

    renderWithProviders(<CompanyProfileTab authenticated />);

    expect(await screen.findByLabelText(/^Legal company name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save company profile/i })).toBeInTheDocument();
  });

  it("loads existing company data into the form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany })));

    renderWithProviders(<CompanyProfileTab authenticated />);

    expect(await screen.findByDisplayValue("Example Media Inc.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jane Publisher")).toBeInTheDocument();
    expect(screen.getByDisplayValue("US")).toBeInTheDocument();
  });

  it("renders required field errors", async () => {
    renderWithProviders(<CompanyProfileForm company={null} />);

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    expect(await screen.findByText("Legal company name is required.")).toBeInTheDocument();
    expect(screen.getByText("Primary contact name is required.")).toBeInTheDocument();
  });

  it("renders invalid email errors", async () => {
    renderWithProviders(<CompanyProfileForm company={null} />);
    fillValidProfile({ "Primary contact email": "not-an-email" });

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it("uses the allowed company type options", async () => {
    renderWithProviders(<CompanyProfileForm company={null} />);

    fireEvent.click(getInputByLabel(/^Company type/i));

    for (const companyType of companyTypeValues) {
      expect(await screen.findByText(companyType)).toBeInTheDocument();
    }
  });

  it("submits only allowed company profile fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany }, 201));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<CompanyProfileForm company={null} />);
    fillValidProfile();

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/company", expect.any(Object)));
    expect(Object.keys(readLastJsonBody(fetchMock)).sort()).toEqual(
      [
        "addressLine1",
        "addressLine2",
        "billingContactEmail",
        "city",
        "companyType",
        "country",
        "description",
        "displayName",
        "legalName",
        "postalCode",
        "primaryContactEmail",
        "primaryContactName",
        "region"
      ].sort()
    );
  });

  it("does not include companyId or company_id in submit payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany }, 201));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<CompanyProfileForm company={null} />);
    fillValidProfile();

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = readLastJsonBody(fetchMock);
    expect(body).not.toHaveProperty("companyId");
    expect(body).not.toHaveProperty("company_id");
  });

  it("renders server validation_error field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Invalid company profile.",
              fields: {
                primaryContactEmail: "Use a company email address."
              }
            }
          },
          400
        )
      )
    );
    renderWithProviders(<CompanyProfileForm company={null} />);
    fillValidProfile();

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    expect(await screen.findByText("Use a company email address.")).toBeInTheDocument();
    expect(screen.getByText("Invalid company profile.")).toBeInTheDocument();
  });

  it("preserves user input when server validation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Invalid company profile.",
              fields: {
                legalName: "Legal name is already in use."
              }
            }
          },
          400
        )
      )
    );
    renderWithProviders(<CompanyProfileForm company={null} />);
    fillValidProfile({ "Legal company name": "Draft Publisher" });

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    expect(await screen.findByText("Legal name is already in use.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Draft Publisher")).toBeInTheDocument();
  });

  it("disables submit while saving", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    renderWithProviders(<CompanyProfileForm company={null} />);
    fillValidProfile();

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save company profile/i })).toBeDisabled();
    });
  });

  it("renders save success state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany }, 200)));
    renderWithProviders(<CompanyProfileForm company={existingCompany} />);

    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    expect(await screen.findByText("Your company profile has been saved.")).toBeInTheDocument();
  });

  it("opens the Company Profile tab automatically for an authenticated user with no company", async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === "/api/session") {
        return Promise.resolve(
          jsonResponse({
            authenticated: true,
            user: {
              email: "jane@example.com",
              firstName: "Jane",
              lastName: "Publisher",
              role: "owner",
              hasCompany: false
            }
          })
        );
      }

      if (path === "/api/company") {
        return Promise.resolve(jsonResponse({ company: null }));
      }

      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText(/no company profile has been created yet/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /company profile/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
