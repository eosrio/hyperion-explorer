/** Keep unavailable projections distinct from empty or missing history results. */
export function describeApiError(error: unknown): string {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  if (isProtocolProjectionUnavailable(error)) return "This data is not available from this Hyperion API yet. Other explorer pages still work.";
  if (status === 503) return "This data is temporarily unavailable while Hyperion recovers. Try again shortly.";
  if (status === 429) return "The API request limit was reached. Wait a moment and try again.";
  if (status === 404) return "The requested data was not found. Check the account, contract, or identifier and try again.";
  if (status === 0) return "Unable to reach the Hyperion API. Check your connection and try again.";
  if (error && typeof error === "object" && "name" in error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "The Hyperion API took too long to respond. Try again.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to load this data from Hyperion. Try again.";
}

export function isApiNotFound(error: unknown): boolean {
  return !!error && typeof error === "object" && "status" in error && error.status === 404;
}

export function isProtocolProjectionUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error) || error.status !== 503 || !("error" in error)) return false;
  const body = error.error;
  return !!body && typeof body === "object" && "code" in body && body.code === "protocol_projection_unavailable";
}
