export class ApiError extends Error {
  constructor(
    message: string,
    readonly response: Response,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}) {
  const response = await apiRequest(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers
    }
  });

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ApiError(apiErrorMessage(body, response), response, body);
  }

  return body as T;
}

export function apiRequest(path: string, init: RequestInit = {}) {
  const requestInit = {
    credentials: "include",
    ...init
  } satisfies RequestInit;

  logFrontendApiRequest(path, requestInit);

  return fetch(path, requestInit);
}

export async function readJsonBody(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function apiErrorMessage(body: unknown, response: Response) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object" &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return `Request failed with status ${response.status}.`;
}

function logFrontendApiRequest(path: string, init: RequestInit) {
  if (!isFrontendApiDiagnosticsEnabled()) {
    return;
  }

  console.info({
    event: "frontend_api_request",
    method: init.method ?? "GET",
    url: path,
    locationHref: window.location.href,
    locationOrigin: window.location.origin,
    locationHost: window.location.host
  });
}

function isFrontendApiDiagnosticsEnabled() {
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
