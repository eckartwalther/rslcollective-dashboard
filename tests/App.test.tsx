import { render, screen } from "@testing-library/react";
import html from "../index.html?raw";
import { App } from "../src/app/App";
import { setClerkAuthState } from "./setup";

describe("App scaffold", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the signed-out login route instead of a dashboard interstitial", async () => {
    setClerkAuthState({ isSignedIn: false });
    window.history.pushState(null, "", "/");

    render(<App />);

    expect(await screen.findByTestId("clerk-sign-in")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /sign in required/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/publisher@example.com/i)).not.toBeInTheDocument();
  });

  it("includes the favicon in the html entrypoint", () => {
    expect(html).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
  });
});
