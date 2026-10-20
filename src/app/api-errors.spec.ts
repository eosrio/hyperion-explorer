import { describeApiError } from "./api-errors";

describe("Hyperion API errors", () => {
  it("explains retryable unavailability without claiming there are no results", () => {
    expect(describeApiError({ status: 503 })).toContain("temporarily unavailable");
  });
  it("distinguishes rate limits from connectivity failures", () => {
    expect(describeApiError({ status: 429 })).toContain("request limit");
    expect(describeApiError({ status: 0 })).toContain("connection");
  });
  it("explains timeouts and preserves metadata validation errors", () => {
    expect(describeApiError(new DOMException("timeout", "TimeoutError"))).toContain("too long");
    expect(describeApiError(new Error("Invalid metadata"))).toBe("Invalid metadata");
  });
});
