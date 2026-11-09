import { nameBreaks } from "./name-breaks";

describe("nameBreaks", () => {
  it("splits after each underscore and keeps the text intact", () => {
    const parts = nameBreaks("context_free_discount_net_usage_num");
    expect(parts).toEqual(["context_", "free_", "discount_", "net_", "usage_", "num"]);
    expect(parts.join("")).toBe("context_free_discount_net_usage_num");
  });

  it("leaves names without underscores whole", () => {
    expect(nameBreaks("producers")).toEqual(["producers"]);
    expect(nameBreaks(42)).toEqual(["42"]);
    expect(nameBreaks(null)).toEqual([""]);
  });
});
