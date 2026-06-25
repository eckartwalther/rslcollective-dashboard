import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import type { ReactNode } from "react";

export const clerkSignOutMock = vi.fn(() => Promise.resolve());
export const clerkGetTokenMock = vi.fn(() => Promise.resolve("test-clerk-token"));
const clerkAuthState = {
  isLoaded: true,
  isSignedIn: true
};

export function setClerkAuthState(overrides: Partial<typeof clerkAuthState>) {
  Object.assign(clerkAuthState, overrides);
}

vi.mock("@clerk/react", async () => {
  const React = await import("react");

  return {
    ClerkProvider: ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children),
    SignIn: () => React.createElement("div", { "data-testid": "clerk-sign-in" }, "Clerk sign in"),
    SignUp: () => React.createElement("div", { "data-testid": "clerk-sign-up" }, "Clerk sign up"),
    useAuth: () => ({
      getToken: clerkGetTokenMock,
      isLoaded: clerkAuthState.isLoaded,
      isSignedIn: clerkAuthState.isSignedIn,
      signOut: clerkSignOutMock
    })
  };
});

class ResizeObserverMock {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })
  });

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock
  });
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock
});

afterEach(() => {
  if (typeof document !== "undefined") {
    document.querySelectorAll('form[action="/logout"]').forEach((form) => form.remove());
  }

  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/dashboard");
  }

  clerkSignOutMock.mockClear();
  clerkGetTokenMock.mockClear();
  setClerkAuthState({
    isLoaded: true,
    isSignedIn: true
  });
});
