import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

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
});
