import { describeApiError, isAccountStateFallbackEligible, isRetryableApiError } from "./api-errors";

describe("Hyperion API errors", () => {
  it("explains retryable unavailability without claiming there are no results", () => {
    expect(describeApiError({ status: 503 })).toContain("temporarily unavailable");
    expect(describeApiError({ status: 503, error: { code: "protocol_projection_unavailable" } })).toContain("not available from this Hyperion API yet");
  });
  it("distinguishes rate limits from connectivity failures", () => {
    expect(describeApiError({ status: 429 })).toContain("request limit");
    expect(describeApiError({ status: 0 })).toContain("connection");
  });
  it("explains timeouts and preserves metadata validation errors", () => {
    expect(describeApiError(new DOMException("timeout", "TimeoutError"))).toContain("too long");
    expect(describeApiError(new Error("Invalid metadata"))).toBe("Invalid metadata");
  });
  it("names client errors with the API's reason and does not offer a retry for them", () => {
    const invalidKey = { status: 400, error: { message: "invalid public key" } };
    expect(describeApiError(invalidKey)).toBe("The Hyperion API could not answer this request: invalid public key.");
    expect(describeApiError({ status: 400, error: { message: "x".repeat(400) } })).toBe("The Hyperion API could not answer this request.");
    expect(isRetryableApiError(invalidKey)).toBe(false);
    expect(isRetryableApiError({ status: 404 })).toBe(false);
  });
  it("offers a retry when waiting can change the outcome", () => {
    for (const status of [0, 429, 500, 502, 503, 504]) expect(isRetryableApiError({ status })).toBe(true);
    expect(isRetryableApiError({ status: 503, error: { code: "protocol_projection_unavailable" } })).toBe(true);
    expect(isRetryableApiError(new DOMException("timeout", "TimeoutError"))).toBe(true);
  });
  it("serves account state from the chain only for stalled projections and gateway timeouts", () => {
    expect(isAccountStateFallbackEligible({ status: 503, error: { code: "protocol_projection_unavailable" } })).toBe(true);
    expect(isAccountStateFallbackEligible({ status: 503, error: { code: "proof_timeout" } })).toBe(true);
    expect(isAccountStateFallbackEligible({ status: 504 })).toBe(true);
    expect(isAccountStateFallbackEligible({ status: 503, error: { message: "Projection recovering" } })).toBe(false);
    expect(isAccountStateFallbackEligible({ status: 500 })).toBe(false);
  });
});
