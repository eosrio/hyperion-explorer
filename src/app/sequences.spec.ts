import { sequence, previousSequence, nextSequence, compareSequences, historyAction, historyResponse, mergeHistory } from "./sequences";

const MAX = "18446744073709551615";
const action = (global_sequence: unknown, receiver = "alice") => ({
  global_sequence,
  receiver,
  trx_id: "f".repeat(64),
  block_num: 100,
  act: { data: {} }
});

describe("Lossless sequence boundaries", () => {
  it.each([
    "0",
    "1",
    "9007199254740991",
    "9007199254740992",
    "9007199254740993",
    "9223372036854775807",
    "9223372036854775808",
    "9223372036854775809",
    MAX
  ])("preserves %s", value => {
    expect(sequence(value)).toBe(value);
  });
  it.each([0, 1, Number.MAX_SAFE_INTEGER])("accepts the exact legacy number %s", value => {
    expect(sequence(value)).toBe(String(value));
  });
  it.each([
    undefined,
    null,
    "",
    "00",
    "01",
    "-1",
    "+1",
    "1.0",
    "1e3",
    " 1",
    "1 ",
    "18446744073709551616",
    "99999999999999999999999999999",
    -1,
    1.5,
    NaN,
    Infinity,
    9007199254740992,
    9007199254740993,
    true,
    {},
    [],
    1n
  ])("rejects invalid or already rounded input %s", value => {
    expect(() => sequence(value)).toThrow("exact uint64 decimal string");
  });
  it("increments and decrements beyond safe integer and signed uint64 boundaries", () => {
    expect(previousSequence(sequence("9007199254740993"))).toBe("9007199254740992");
    expect(nextSequence(sequence("9007199254740992"))).toBe("9007199254740993");
    expect(previousSequence(sequence("9223372036854775808"))).toBe("9223372036854775807");
    expect(nextSequence(sequence("9223372036854775808"))).toBe("9223372036854775809");
    expect(previousSequence(sequence(MAX))).toBe("18446744073709551614");
    expect(nextSequence(sequence(MAX))).toBeNull();
    expect(previousSequence(sequence("0"))).toBeNull();
    expect(previousSequence(sequence("1"))).toBe("0");
  });
  it("orders by integer value, preserving adjacent uint64 identities", () => {
    const values = ["10", MAX, "9", "9007199254740993", "9007199254740992"].map(value => sequence(value));
    expect(values.sort(compareSequences)).toEqual(["9", "10", "9007199254740992", "9007199254740993", MAX]);
  });
});

describe("History and stream metadata", () => {
  it("normalizes receipt/auth sequences without changing contract payloads or uint32 counters", () => {
    const raw = {
      ...action(MAX),
      code_sequence: 7,
      abi_sequence: 8,
      action_ordinal: 9,
      recv_sequence: "9223372036854775808",
      receipts: [
        {
          receiver: "alice",
          global_sequence: MAX,
          recv_sequence: "9007199254740993",
          auth_sequence: [{ account: "alice", sequence: MAX }, ["bob", "9223372036854775808"]]
        }
      ],
      receipt: { global_sequence: MAX, recv_sequence: 4, auth_sequence: [["alice", 0]] },
      act: { data: { global_sequence: "01", sequence: 1.25 } }
    };
    const result = historyAction(Object.freeze(raw));
    expect(result.global_sequence).toBe(MAX);
    expect(result["receipt"].recv_sequence).toBe("4");
    expect(result["receipt"].auth_sequence).toEqual([["alice", "0"]]);
    expect(result["receipts"][0].auth_sequence).toEqual([{ account: "alice", sequence: MAX }, ["bob", "9223372036854775808"]]);
    expect(result.act).toBe(raw.act);
    expect(result.block_num).toBe(100);
    expect(result["code_sequence"]).toBe(7);
    expect(result["abi_sequence"]).toBe(8);
    expect(raw.receipt.recv_sequence).toBe(4);
    expect(JSON.parse(JSON.stringify(result)).global_sequence).toBe(MAX);
  });
  it.each([
    { ...action("1"), receipts: [{ recv_sequence: 9007199254740992 }] },
    { ...action("1"), auth_sequence: [{ account: "alice", sequence: "01" }] },
    { ...action("1"), auth_sequence: [["alice", MAX, "extra"]] },
    { ...action("1"), receipts: {} },
    { ...action("1"), receipt: { global_sequence: "0" } },
    { ...action("1"), auth_sequence: [{ sequence: MAX }] },
    action("0"),
    { block_num: 100 }
  ])("refuses malformed protocol metadata", raw => {
    expect(() => historyAction(raw)).toThrow();
  });
  it("normalizes account/transaction pages and refuses malformed collections", () => {
    expect(historyResponse({ actions: [action(100)], lib: 101 }).actions[0].global_sequence).toBe("100");
    expect(historyResponse({ actions: [] }).actions).toEqual([]);
    expect(() => historyResponse({ actions: null } as any)).toThrow("invalid action history");
  });
  it("merges replay overlaps without dropping adjacent sequences or different receivers", () => {
    const a = historyAction(action("9007199254740992"));
    const b = historyAction(action("9007199254740993"));
    const otherReceipt = historyAction(action("9007199254740993", "bob"));
    expect(mergeHistory([b, a], [a, otherReceipt]).map(row => [row.global_sequence, row.receiver])).toEqual([
      ["9007199254740993", "alice"],
      ["9007199254740993", "bob"],
      ["9007199254740992", "alice"]
    ]);
  });
});
