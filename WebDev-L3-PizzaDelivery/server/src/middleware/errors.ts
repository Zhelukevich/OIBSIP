import type { ErrorRequestHandler, RequestHandler } from "express";

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly errors?: unknown) {
    super(message);
  }
}

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export function logFailure(message: string, error: unknown) {
  console.error(message, { errorType: error instanceof Error ? error.name : typeof error });
}

export const handleError: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ message: error.message, errors: error.errors });
    return;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    if (error.status === 400 || error.status === 413 || error.status === 415) {
      const messages = {
        400: "Invalid request",
        413: "Request body is too large",
        415: "Unsupported request encoding",
      };
      response.status(error.status).json({ message: messages[error.status] });
      return;
    }
  }
  if (isDuplicateKey(error)) {
    response.status(409).json({ message: "Resource already exists" });
    return;
  }
  logFailure(`Request failed (${request.method})`, error);
  response.status(500).json({ message: "Internal server error" });
};
