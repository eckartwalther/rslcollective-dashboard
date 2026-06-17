import { render, screen } from "@testing-library/react";
import html from "../index.html?raw";
import { App } from "../src/app/App";

describe("App scaffold", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the unauthenticated dashboard state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: /sign in required/i })).toBeInTheDocument();
    expect(screen.queryByText(/publisher@example.com/i)).not.toBeInTheDocument();
  });

  it("includes the favicon in the html entrypoint", () => {
    expect(html).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
  });
});
