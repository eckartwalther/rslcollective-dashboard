import packageJson from "../package.json";
import localWranglerConfig from "../wrangler.jsonc?raw";
import productionWranglerConfig from "../wrangler.production.jsonc?raw";

describe("Wrangler config routing", () => {
  it("keeps the production dashboard host out of the local worker:dev config", () => {
    expect(localWranglerConfig).not.toContain("dashboard.rslcollective.org");
    expect(localWranglerConfig).not.toMatch(/"routes"\s*:/);
    expect(localWranglerConfig).not.toMatch(/"route"\s*:/);
    expect(localWranglerConfig).not.toMatch(/"custom_domain"\s*:\s*true/);
    expect(packageJson.scripts["worker:dev"]).toBe("wrangler dev --config wrangler.jsonc");
  });

  it("keeps the production dashboard host in the explicit production config", () => {
    expect(productionWranglerConfig).toContain("dashboard.rslcollective.org");
    expect(productionWranglerConfig).toMatch(/"routes"\s*:/);
    expect(productionWranglerConfig).toMatch(/"custom_domain"\s*:\s*true/);
    expect(packageJson.scripts["worker:deploy"]).toBe(
      "wrangler deploy --config wrangler.production.jsonc"
    );
    expect(packageJson.scripts["db:migrate:remote"]).toContain(
      "--config wrangler.production.jsonc"
    );
  });
});
