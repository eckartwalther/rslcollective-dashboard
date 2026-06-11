import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type ErrorCode =
  | "not_implemented"
  | "unauthenticated"
  | "validation_error"
  | "forbidden"
  | "conflict"
  | "not_found"
  | "server_error";

export function errorResponse(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string
) {
  return c.json(
    {
      error: {
        code,
        message
      }
    },
    status
  );
}

export function notImplemented(c: Context, message: string) {
  return errorResponse(c, 501, "not_implemented", message);
}

export function unauthenticated(c: Context) {
  return errorResponse(c, 401, "unauthenticated", "Authentication required.");
}

export function forbidden(c: Context, message = "Request origin is not allowed.") {
  return errorResponse(c, 403, "forbidden", message);
}

export function validationError(c: Context, message: string, fields?: Record<string, string>) {
  return c.json(
    {
      error: {
        code: "validation_error",
        message,
        ...(fields ? { fields } : {})
      }
    },
    400
  );
}

export function conflict(c: Context, message: string) {
  return errorResponse(c, 409, "conflict", message);
}

export function notFound(c: Context) {
  return errorResponse(c, 404, "not_found", "Route not found.");
}

export function serverError(c: Context, message = "An unexpected error occurred.") {
  return errorResponse(c, 500, "server_error", message);
}
