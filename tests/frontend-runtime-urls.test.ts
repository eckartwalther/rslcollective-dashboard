import clientSource from "../src/api/client.ts?raw";
import companySource from "../src/api/company.ts?raw";
import sessionSource from "../src/api/session.ts?raw";
import workerAuthSource from "../worker/routes/auth.ts?raw";
import workerSessionSource from "../worker/lib/session.ts?raw";
import workerWorkosSource from "../worker/lib/workos.ts?raw";

const runtimeFrontendSources = [clientSource, companySource, sessionSource];
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
});
