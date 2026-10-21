import { asUtcTimestamp, formatBytes } from "./utils";

describe("chain resource units and timestamps", () => {
  it.each([
    [0, "0 B"],
    [1024, "1 KiB"],
    [1048576, "1 MiB"],
    [8560, "8.36 KiB"],
    [-1, "Unavailable"]
  ])("formats %s bytes as %s", (value, expected) => {
    expect(formatBytes(Number(value))).toBe(expected);
  });
  it("treats an unsuffixed chain timestamp as UTC and preserves explicit offsets", () => {
    expect(asUtcTimestamp("2026-10-21T12:00:00.000")).toBe("2026-10-21T12:00:00.000Z");
    expect(asUtcTimestamp("2026-10-21T12:00:00Z")).toBe("2026-10-21T12:00:00Z");
    expect(asUtcTimestamp("2026-10-21T09:00:00-03:00")).toBe("2026-10-21T09:00:00-03:00");
  });
});
