import clientSource from "../src/api/client.ts?raw";
import companySource from "../src/api/company.ts?raw";
import runtimeDiagnosticsSource from "../src/api/runtimeDiagnostics.ts?raw";
import sessionSource from "../src/api/session.ts?raw";
import dashboardShellSource from "../src/components/layout/DashboardShell.tsx?raw";
import indexHtmlSource from "../index.html?raw";
import workerAuthSource from "../worker/routes/auth.ts?raw";
import workerSessionSource from "../worker/lib/session.ts?raw";
import workerWorkosSource from "../worker/lib/workos.ts?raw";

const runtimeFrontendSources = [
  clientSource,
  companySource,
  runtimeDiagnosticsSource,
  sessionSource,
  dashboardShellSource
];
const runtimeRedirectHelperSources = [
  workerAuthSource,
  workerSessionSource,
  workerWorkosSource
];

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

  it("keeps the logout form action relative", () => {
    expect(sessionSource).toContain('form.action = "/logout"');
    expect(sessionSource).not.toMatch(/form\.action\s*=\s*["']https?:\/\/dashboard\.rslcollective\.org/);
  });

  it("does not define a base href in index.html", () => {
    expect(indexHtmlSource).not.toMatch(/<base\b/i);
    expect(indexHtmlSource).not.toContain("dashboard.rslcollective.org");
  });
});
