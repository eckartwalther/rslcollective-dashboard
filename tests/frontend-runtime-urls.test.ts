import clientSource from "../src/api/client.ts?raw";
import companySource from "../src/api/company.ts?raw";
import sessionSource from "../src/api/session.ts?raw";
import dashboardShellSource from "../src/components/layout/DashboardShell.tsx?raw";
import indexHtmlSource from "../index.html?raw";
import workerClerkSource from "../worker/lib/clerk.ts?raw";

const runtimeFrontendSources = [
  clientSource,
  companySource,
  sessionSource,
  dashboardShellSource
];
const runtimeRedirectHelperSources = [
  workerClerkSource
];
const removedProviderName = ["Auth", "0"].join("");
const removedProviderIdentifier = removedProviderName.toLowerCase();
const scannedSources = import.meta.glob(
  [
    "../README.md",
    "../docs/**/*.md",
    "../migrations/**/*.sql",
    "../src/**/*.{css,ts,tsx}",
    "../tests/**/*.{ts,tsx}",
    "../worker/**/*.ts",
    "../wrangler*.jsonc"
  ],
  {
    eager: true,
    import: "default",
    query: "?raw"
  }
) as Record<string, unknown>;

function rawSource(source: unknown): string {
  if (typeof source === "string") {
    return source;
  }

  if (
    typeof source === "object" &&
    source !== null &&
    "default" in source &&
    typeof source.default === "string"
  ) {
    return source.default;
  }

  return "";
}

describe("frontend runtime URLs", () => {
  it("does not hardcode dashboard.rslcollective.org in API or action URLs", () => {
    for (const source of runtimeFrontendSources) {
      expect(source).not.toContain("dashboard.rslcollective.org");
    }
  });

  it("does not hardcode dashboard.rslcollective.org in runtime redirect helpers", () => {
    for (const source of runtimeRedirectHelperSources) {
      expect(source).not.toContain("dashboard.rslcollective.org");
    }
  });

  it("does not use the removed local logout form", () => {
    expect(sessionSource).not.toContain('form.action = "/logout"');
    expect(sessionSource).not.toMatch(/form\.action\s*=/);
  });

  it("does not define a base href in index.html", () => {
    expect(indexHtmlSource).not.toMatch(/<base\b/i);
    expect(indexHtmlSource).not.toContain("dashboard.rslcollective.org");
  });

  it("does not expose provider secrets from frontend runtime sources", () => {
    for (const source of runtimeFrontendSources) {
      expect(source).not.toContain("CLERK_SECRET_KEY");
      expect(source).not.toContain("CLERK_JWT_KEY");
    }
  });

  it("does not keep removed provider references in source or docs", () => {
    const matches = Object.entries(scannedSources).filter(([, source]) => {
      const text = rawSource(source);

      return text.includes(removedProviderName) || text.includes(removedProviderIdentifier);
    });

    expect(matches.map(([path]) => path)).toEqual([]);
  });
});
