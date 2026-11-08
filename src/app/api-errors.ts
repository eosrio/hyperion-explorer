/** What an error strip shows: plain copy, and whether retrying can change the outcome. */
export interface ApiErrorView {
  message: string;
  retryable: boolean;
}

function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

function errorBody(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object" || !("error" in error)) return null;
  const body = error.error;
  return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
}

/** The API's own short reason (for example "invalid public key"), when it gives one. */
function apiReason(error: unknown): string | null {
  const message = errorBody(error)?.["message"];
  if (typeof message !== "string") return null;
  const reason = message.trim().replace(/\s+/g, " ");
  return reason && reason.length <= 160 ? reason.replace(/[.!]+$/, "") : null;
}

/** Keep unavailable projections distinct from empty or missing history results. */
export function describeApiError(error: unknown): string {
  const status = httpStatus(error);
  if (isProtocolProjectionUnavailable(error)) return "This data is not available from this Hyperion API yet. Other explorer pages still work.";
  if (status === 503 || status === 502) return "This data is temporarily unavailable. Try again shortly.";
  if (status === 504) return "The Hyperion API took too long to respond. Try again shortly.";
  if (status === 429) return "The API request limit was reached. Wait a moment and try again.";
  if (status === 404) return "The requested data was not found. Check the account, contract, or identifier.";
  if (status === 0) return "Unable to reach the Hyperion API. Check your connection and try again.";
  if (status !== undefined && status >= 400 && status < 500) {
    const reason = apiReason(error);
    return reason ? `The Hyperion API could not answer this request: ${reason}.` : "The Hyperion API could not answer this request.";
  }
  if (error && typeof error === "object" && "name" in error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "The Hyperion API took too long to respond. Try again.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to load this data from Hyperion. Try again.";
}

/**
 * Only offer "Try again" when waiting can help: outages, projections still being built, timeouts,
 * rate limits and network failures. Client errors (bad identifiers, unsupported formats, not found)
 * return the same answer every time.
 */
export function isRetryableApiError(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === undefined || status === 0 || status === 429 || status >= 500) return true;
  return status < 400;
}

export function apiErrorView(error: unknown): ApiErrorView {
  return { message: describeApiError(error), retryable: isRetryableApiError(error) };
}

export function isApiNotFound(error: unknown): boolean {
  return httpStatus(error) === 404;
}

export function isProtocolProjectionUnavailable(error: unknown): boolean {
  return httpStatus(error) === 503 && errorBody(error)?.["code"] === "protocol_projection_unavailable";
}

/**
 * Account state can be served from the chain when the state projection is missing or stalled
 * (a coded 503, such as a projection proof timeout, or a gateway timeout). An uncoded 503 means the
 * API itself is down, so it stays an error instead of masking the outage.
 */
export function isAccountStateFallbackEligible(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === 504) return true;
  const code = errorBody(error)?.["code"];
  return status === 503 && (code === "protocol_projection_unavailable" || code === "proof_timeout");
}
