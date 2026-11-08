import { describeAction, GrammarLine, parseAsset } from "./action-grammar";

/** Flatten lines into readable text so expectations stay close to what a visitor sees. */
function read(lines: GrammarLine[] | null): string[] | null {
  if (!lines) return null;
  return lines.map(line =>
    line
      .map(part => {
        switch (part.kind) {
          case "account":
            return part.name;
          case "permission":
            return `${part.actor}@${part.permission}`;
          case "arrow":
            return "→";
          case "amount":
            return `${part.asset.whole}${part.asset.fraction} ${part.asset.symbol}`;
          case "memo":
            return `"${part.text}"`;
          case "key":
            return part.key;
          case "hash":
            return `<${part.label}>`;
          default:
            return part.text;
        }
      })
      .join(" ")
  );
}

describe("action grammar", () => {
  it("parses assets without floating point and groups the whole part", () => {
    expect(parseAsset("39151.475694444 WIRE")).toEqual({ whole: "39,151", fraction: ".475694444", symbol: "WIRE" });
    expect(parseAsset("-1234567890123456789.0001 EOS")).toEqual({ whole: "-1,234,567,890,123,456,789", fraction: ".0001", symbol: "EOS" });
    expect(parseAsset("10 RAMCORE")).toEqual({ whole: "10", fraction: "", symbol: "RAMCORE" });
    expect(parseAsset("10.0 sys")).toBeNull();
    expect(parseAsset(12)).toBeNull();
  });

  it("reads token transfers on any contract and keeps the memo", () => {
    const data = { from: "sysio", to: "eosrio", quantity: "39151.475694444 WIRE", memo: "Node Owner distribution", amount: 39151.475694444 };
    expect(read(describeAction("sysio.token", "transfer", data, "sysio"))).toEqual([
      "sysio → eosrio",
      "39,151.475694444 WIRE",
      '"Node Owner distribution"'
    ]);
    expect(read(describeAction("seed.token", "transfer", { ...data, memo: "" }, "sysio"))).toHaveLength(2);
  });

  it("falls back to raw data when the shape is not what the rule expects", () => {
    expect(describeAction("sysio.token", "transfer", { from: "sysio", to: "eosrio", quantity: "lots" }, "sysio")).toBeNull();
    expect(describeAction("sysio.token", "transfer", "0000000000eab0c7", "sysio")).toBeNull();
    expect(describeAction("sysio", "updateauth", { account: "alice", permission: "claim", auth: { threshold: "1" } }, "sysio")).toBeNull();
    expect(describeAction("game", "move", { x: 1 }, "sysio")).toBeNull();
  });

  it("only reads account and resource actions on the chain's system contract", () => {
    const vote = { voter: "alice", proxy: "", producers: ["bp1", "bp2"] };
    expect(read(describeAction("sysio", "voteproducer", vote, "sysio"))).toEqual(["alice voted for 2 producers", "bp1 bp2"]);
    expect(describeAction("eosio", "voteproducer", vote, "sysio")).toBeNull();
  });

  it("explains permission changes", () => {
    const auth = {
      threshold: 1,
      keys: [{ key: "PUB_K1_6PH7zKDfntTyR4YENb726usBU", weight: 1 }],
      accounts: [{ permission: { actor: "bob", permission: "active" }, weight: 1 }],
      waits: []
    };
    expect(read(describeAction("sysio", "updateauth", { account: "eosrio", permission: "claim", parent: "active", auth }, "sysio"))).toEqual([
      "eosrio@claim under eosrio@active",
      "requires weight 1 from 2 signers",
      "PUB_K1_6PH7zKDfntTyR4YENb726usBU weight 1",
      "bob@active weight 1"
    ]);
    expect(read(describeAction("sysio", "linkauth", { account: "eosrio", code: "sysio", type: "claimnodedis", requirement: "claim" }, "sysio"))).toEqual([
      "sysio::claimnodedis now requires eosrio@claim"
    ]);
  });

  it("reads producer and finalizer registration with copyable keys", () => {
    expect(
      read(describeAction("sysio", "regproducer", { producer: "defproducere", producer_key: "PUB_K1_7nBo", url: "", location: 0 }, "sysio"))
    ).toEqual(["defproducere registered as a block producer", "signing key PUB_K1_7nBo"]);
    expect(
      read(
        describeAction("sysio", "regfinkey", { finalizer_name: "defproducere", finalizer_key: "PUB_BLS_x", proof_of_possession: "SIG_BLS_y" }, "sysio")
      )
    ).toEqual(["defproducere registered a finalizer key", "<finalizer key>", "proof of possession <proof of possession>"]);
  });

  it("summarises long lists instead of growing the row", () => {
    const producers = ["bp1", "bp2", "bp3", "bp4", "bp5", "bp11", "bp12", "bp13"];
    const lines = read(describeAction("eosio", "voteproducer", { voter: "alice", proxy: "", producers }, "eosio"))!;
    expect(lines[1]).toBe("bp1 bp2 bp3 bp4 bp5 bp11");
    expect(lines[2]).toBe("+2 more");
  });
});
