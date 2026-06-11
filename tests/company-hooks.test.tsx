import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import {
  ApiError
} from "../src/api/client";
import {
  companyQueryKey,
  getCompany,
  saveCompany,
  useCompanyQuery,
  useSaveCompanyMutation
} from "../src/api/company";
import { sessionQueryKey } from "../src/api/session";
import { AppProviders } from "../src/app/providers";
import { CompanyProfileTab } from "../src/components/dashboard/CompanyProfileTab";

const existingCompany = {
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function renderWithQueryClient(children: ReactNode, queryClient = createQueryClient()) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function CompanyQueryProbe({ authenticated }: { authenticated: boolean }) {
  useCompanyQuery(authenticated);
  return null;
}

function SaveProbe({ payload }: { payload: Record<string, unknown> }) {
  const mutation = useSaveCompanyMutation();

  return <button onClick={() => mutation.mutate(payload)}>Save</button>;
}

describe("company API hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("disables the company query when unauthenticated", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CompanyQueryProbe authenticated={false} />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs the company query when authenticated", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: null }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CompanyQueryProbe authenticated />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/company",
        expect.objectContaining({ credentials: "include" })
      );
    });
  });

  it("calls GET /api/company from the API client", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: null }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCompany()).resolves.toEqual({ company: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/company",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("calls PUT /api/company from the save mutation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<SaveProbe payload={{ legalName: "Example Media Inc." }} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/company",
        expect.objectContaining({
          credentials: "include",
          method: "PUT"
        })
      );
    });
  });

  it("invalidates the company query after save success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany }, 200));
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(
      <SaveProbe payload={{ legalName: "Example Media Inc." }} />,
      queryClient
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: companyQueryKey });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: sessionQueryKey });
  });

  it("invalidates the session query after first company creation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany }, 201));
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(
      <SaveProbe payload={{ legalName: "Example Media Inc." }} />,
      queryClient
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: companyQueryKey });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sessionQueryKey });
    });
  });

  it("preserves validation_error responses for later form handling", async () => {
    const validationBody = {
      error: {
        code: "validation_error",
        message: "Invalid company profile.",
        fields: { primaryContactEmail: "Enter a valid email address." }
      }
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(validationBody, 400)));

    await expect(saveCompany({ primaryContactEmail: "bad-email" })).rejects.toMatchObject({
      body: validationBody,
      message: "Invalid company profile."
    } satisfies Partial<ApiError>);
  });

  it("does not send companyId or company_id from the frontend save function", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await saveCompany({
      legalName: "Example Media Inc.",
      companyId: "cmp_client",
      company_id: "cmp_client"
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toEqual({ legalName: "Example Media Inc." });
    expect(body).not.toHaveProperty("companyId");
    expect(body).not.toHaveProperty("company_id");
  });

  it("renders the company loading placeholder state", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));

    render(
      <AppProviders>
        <CompanyProfileTab authenticated />
      </AppProviders>
    );

    expect(screen.getByText(/loading company profile/i)).toBeInTheDocument();
  });

  it("renders the empty company placeholder state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ company: null })));

    render(
      <AppProviders>
        <CompanyProfileTab authenticated />
      </AppProviders>
    );

    expect(await screen.findByText(/no company profile has been created yet/i)).toBeInTheDocument();
  });

  it("renders the existing company form state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ company: existingCompany })));

    render(
      <AppProviders>
        <CompanyProfileTab authenticated />
      </AppProviders>
    );

    expect(await screen.findByDisplayValue("Example Media Inc.")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Publisher")[0]).toBeInTheDocument();
    expect(screen.getByDisplayValue("US")).toBeInTheDocument();
  });
});
