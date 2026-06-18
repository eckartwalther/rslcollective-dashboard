export function browserRuntimeSnapshot() {
  return {
    locationHref: window.location.href,
    locationOrigin: window.location.origin,
    locationHost: window.location.host,
    documentReferrer: document.referrer,
    documentBaseURI: document.baseURI
  };
}

export function isFrontendRuntimeDiagnosticsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  if (import.meta.env.MODE === "test") {
    return false;
  }

  return import.meta.env.DEV || isLocalBrowserHost(window.location.hostname);
}

function isLocalBrowserHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}
