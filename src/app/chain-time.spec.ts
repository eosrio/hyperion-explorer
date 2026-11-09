import { ageOfChainTime } from "./chain-time";

describe("ageOfChainTime", () => {
  // Chain timestamps are UTC without a zone suffix; the age must not depend on the reader's time zone.
  const now = Date.parse("2026-11-09T12:00:00Z");

  it("describes activity within the last day", () => {
    expect(ageOfChainTime("2026-11-09T11:59:40.000", now)).toBe("just now");
    expect(ageOfChainTime("2026-11-09T11:48:00.000", now)).toBe("12 min ago");
    expect(ageOfChainTime("2026-11-09T09:00:00.000", now)).toBe("3 h ago");
  });

  it("leaves older, future and malformed timestamps to the full time", () => {
    expect(ageOfChainTime("2026-11-08T11:59:00.000", now)).toBeNull();
    expect(ageOfChainTime("2026-11-09T12:05:00.000", now)).toBeNull();
    expect(ageOfChainTime("not a time", now)).toBeNull();
    expect(ageOfChainTime(null, now)).toBeNull();
  });
});
