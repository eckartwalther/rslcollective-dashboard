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

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  authToken?: string | null
) {
  const response = await apiRequest(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers
    }
  }, authToken);

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ApiError(apiErrorMessage(body, response), response, body);
  }

  return body as T;
}

export function apiRequest(path: string, init: RequestInit = {}, authToken?: string | null) {
  const headers = new Headers(init.headers);

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  return fetch(path, {
    ...init,
    headers
  });
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
