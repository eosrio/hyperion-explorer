import { createHash } from "node:crypto";

export const publicKey = "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5SoA82QKS2jD1xrF1vARe";
export const chainId = "a".repeat(64);
export const txId = "f".repeat(64);
export const accountNames = [
  "eosio",
  "alice",
  "bob",
  "carol",
  "dan",
  "vault.defi",
  "eosio.token",
  "seed.token",
  "oracle",
  "harborbp",
  "canopybp",
  "usd.token"
];
export const hash = value => createHash("sha256").update(String(value)).digest("hex");
export const blockId = number => number.toString(16).padStart(8, "0") + hash(`block:${number}`).slice(8);
export const timestamp = offset => new Date(Date.UTC(2026, 9, 21, 12, 0, 0) + offset * 500).toISOString().replace(/Z$/, "");
const auth = [{ actor: "eosio", permission: "active" }];

export const themes = {
  default: {},
  forest: {
    "--primary": "#216a54",
    "--primary-gradient": "linear-gradient(145deg, #28795e, #18533f)",
    "--main-background": "#e0ece5",
    "--main-text": "#172c24",
    "--faded": "#4d6b5e",
    "--card-bg": "#f6faf7",
    "--card-bg-gradient": "linear-gradient(115deg, #edf5ef, #fbfdfb)",
    "--colour-bg-shadow": "#c6d8cc",
    "--colour-bg-highlight": "#ffffff",
    "--line-divider": "#c8d9ce"
  },
  dark: {
    "--primary": "#7acbff",
    "--primary-gradient": "linear-gradient(145deg, #8bd1ff, #5ab4e9)",
    "--btn-primary-color": "#10202d",
    "--main-background": "#172330",
    "--main-text": "#e4edf7",
    "--faded": "#adbed1",
    "--footer-text": "#adbed1",
    "--accent": "#ffc48b",
    "--pending": "#ffc48b",
    "--success": "#80d9ab",
    "--card-bg": "#223344",
    "--card-bg-gradient": "linear-gradient(115deg, #203142, #263a4d)",
    "--table-top-bg-gradient": "linear-gradient(115deg, #203142, #263a4d)",
    "--colour-bg-shadow": "#101c27",
    "--colour-bg-highlight": "#354d64",
    "--line-divider": "#41566a"
  }
};

export function account(name = "eosio", empty = false) {
  if (!accountNames.includes(name) && !producers.some(row => row.owner === name) && name !== "empty") return null;
  const index = Math.max(0, accountNames.indexOf(name));
  const balance = (84250.125 + index * 105.25).toFixed(4);
  const permissions = [
    { perm_name: "owner", parent: "", required_auth: { threshold: 1, keys: [{ key: publicKey, weight: 1 }], accounts: [], waits: [] } },
    {
      perm_name: "active",
      parent: "owner",
      required_auth: {
        threshold: 2,
        keys: [{ key: publicKey, weight: 2 }],
        accounts: [{ permission: { actor: "vault.defi", permission: "active" }, weight: 1 }],
        waits: []
      }
    },
    {
      perm_name: "posting",
      parent: "active",
      required_auth: {
        threshold: 1,
        keys: [],
        accounts: [{ permission: { actor: "alice", permission: "active" }, weight: 1 }],
        waits: [{ wait_sec: 3600, weight: 1 }]
      }
    }
  ];
  return {
    account_name: name,
    head_block_num: 102,
    head_block_time: timestamp(4),
    privileged: name === "eosio",
    created: "2021-04-15T09:24:11.000",
    last_code_update: ["eosio", "eosio.token", "seed.token", "vault.defi"].includes(name)
      ? "2026-09-28T14:02:00.000"
      : "1970-01-01T00:00:00.000",
    core_liquid_balance: `${empty ? "0.0000" : balance} SYS`,
    ram_quota: 1048576,
    ram_usage: empty ? 0 : 287340,
    cpu_limit: { used: empty ? 0 : 1450, available: 98550, max: 100000 },
    net_limit: { used: empty ? 0 : 8560, available: 253584, max: 262144 },
    cpu_weight: 1250000,
    net_weight: 450000,
    permissions: empty ? [] : permissions,
    total_resources: { owner: name, net_weight: "45.0000 SYS", cpu_weight: "125.0000 SYS", ram_bytes: 1048576 },
    self_delegated_bandwidth: { from: name, to: name, net_weight: "30.0000 SYS", cpu_weight: "100.0000 SYS" },
    refund_request: empty ? null : { owner: name, request_time: timestamp(-120), net_amount: "2.5000 SYS", cpu_amount: "5.0000 SYS" },
    voter_info: { owner: name, proxy: "", producers: empty ? [] : ["harborbp", "canopybp"], staked: 1250000, is_proxy: 0 }
  };
}

export function action(index = 0, overrides = {}) {
  const type = index % 6;
  const from = index % 2 ? "alice" : "eosio";
  const variants = [
    {
      account: "eosio.token",
      name: "transfer",
      data: {
        from,
        to: from === "eosio" ? "alice" : "eosio",
        quantity: `${(125 + index * 3.75).toFixed(4)} SYS`,
        memo: index === 0 ? "Fixture transfer" : `Settlement · invoice ${202600 + index}`
      }
    },
    {
      account: "seed.token",
      name: "transfer",
      data: { from, to: "eosio", quantity: `${(2400 + index * 10).toFixed(4)} SEED`, memo: "Community rewards · October" }
    },
    {
      account: "eosio",
      name: "delegatebw",
      data: { from: "eosio", receiver: "bob", stake_net_quantity: "10.0000 SYS", stake_cpu_quantity: "25.0000 SYS", transfer: false }
    },
    { account: "eosio", name: "voteproducer", data: { voter: "eosio", proxy: "", producers: ["harborbp", "canopybp"] } },
    {
      account: "vault.defi",
      name: "deposit",
      data: { owner: "eosio", quantity: "50.0000 SYS", vault_id: "18446744073709551610", memo: "Savings vault" }
    },
    { account: "eosio", name: "buyram", data: { payer: "eosio", receiver: "carol", quant: "2.5000 SYS" } }
  ];
  const global_sequence = (9007199254741100n - BigInt(index)).toString();
  const act = { ...variants[type], authorization: auth };
  return {
    "@timestamp": timestamp(-index),
    timestamp: timestamp(-index),
    block_num: 100 - Math.floor(index / 3),
    block_id: blockId(100 - Math.floor(index / 3)),
    trx_id: index === 0 ? txId : hash(`transaction:${index}`),
    global_sequence,
    receiver: act.account,
    recv_sequence: (9223372036854775808n + BigInt(index)).toString(),
    code_sequence: 4,
    abi_sequence: 7,
    action_ordinal: 1,
    creator_action_ordinal: 0,
    act,
    cpu_usage_us: 184 + index * 7,
    net_usage_words: 19 + index,
    receipts: [
      {
        receiver: act.account,
        global_sequence,
        recv_sequence: (9223372036854775808n + BigInt(index)).toString(),
        auth_sequence: [{ account: "eosio", sequence: (9007199254741200n + BigInt(index)).toString() }]
      }
    ],
    notified: ["eosio", "alice"],
    ...overrides
  };
}

export function history(state) {
  if (state.emptyHistory) return [];
  if (state.unsafeSequence) return [action(0, { global_sequence: 2 ** 53 })];
  if (state.sequences)
    return state.sequences.map((global_sequence, index) => {
      const row = action(index, { global_sequence, trx_id: txId, block_num: 100 });
      row.act = { ...action(0).act, data: { ...action(0).act.data, memo: `Sequence ${global_sequence}` } };
      row.auth_sequence = [{ account: "eosio", sequence: "9007199254740993" }];
      row.receipts = [
        { receiver: "eosio.token", global_sequence, recv_sequence: "9223372036854775808", auth_sequence: [["eosio", "9007199254740993"]] }
      ];
      row.recv_sequence = "9223372036854775808";
      return row;
    });
  return Array.from({ length: 72 }, (_, index) => action(index));
}

export function filterActions(rows, query) {
  let result = rows.filter(row => {
    const name = query.get("account");
    if (
      name &&
      name !== "eosio" &&
      !row.notified?.includes(name) &&
      row.receiver !== name &&
      !row.act.authorization.some(auth => auth.actor === name)
    )
      return false;
    for (const key of ["act.account", "act.name", "@transfer.from", "@transfer.to"]) {
      const filter = query.get(key);
      const value = key === "act.account" ? row.act.account : key === "act.name" ? row.act.name : row.act.data[key.split(".")[1]];
      if (filter && (filter.startsWith("!") ? value === filter.slice(1) : value !== filter)) return false;
    }
    const range = query.get("global_sequence");
    if (range) {
      const [lo, hi] = range.split("-");
      if (lo && BigInt(row.global_sequence) < BigInt(lo)) return false;
      if (hi && BigInt(row.global_sequence) > BigInt(hi)) return false;
    }
    return true;
  });
  result.sort((a, b) =>
    BigInt(a.global_sequence) < BigInt(b.global_sequence) ? 1 : BigInt(a.global_sequence) > BigInt(b.global_sequence) ? -1 : 0
  );
  if (query.get("sort") === "asc") result.reverse();
  const total = result.length;
  const skip = Number(query.get("skip") || 0);
  const limit = Math.min(1000, Number(query.get("limit") || 20));
  return {
    actions: result.slice(skip, skip + limit),
    total: { value: total, relation: "eq" },
    lib: 101,
    cached: false,
    query_time_ms: 3.2
  };
}

export const producers = Array.from({ length: 21 }, (_, index) => ({
  owner: ["harborbp", "canopybp", "meridianbp", "cedarbp", "atlasbp"][index] || `producer${"abcdefghijklmnop"[index - 5]}`,
  total_votes: (1500000000000000 - index * 23500000000000).toString(),
  producer_key: publicKey,
  is_active: 1,
  url: "https://example.com",
  unpaid_blocks: 120 + index * 4,
  last_claim_time: timestamp(-1000),
  location: 76 + index
}));

export function abi(code) {
  const structs = [
    { name: "account", base: "", fields: [{ name: "balance", type: "asset" }] },
    {
      name: "currency_stats",
      base: "",
      fields: [
        { name: "supply", type: "asset" },
        { name: "max_supply", type: "asset" },
        { name: "issuer", type: "name" }
      ]
    },
    {
      name: "vault",
      base: "",
      fields: [
        { name: "id", type: "uint64" },
        { name: "owner", type: "name" },
        { name: "balance", type: "asset" },
        { name: "status", type: "string" }
      ]
    }
  ];
  return {
    account_name: code,
    abi: {
      version: "eosio::abi/1.2",
      types: [],
      structs,
      actions: [],
      variants: [],
      ricardian_clauses: [],
      tables: [
        { name: "accounts", type: "account", index_type: "i64", key_names: [], key_types: [] },
        { name: "stat", type: "currency_stats", index_type: "i64", key_names: [], key_types: [] },
        ...(code === "vault.defi" ? [{ name: "vaults", type: "vault", index_type: "i64", key_names: [], key_types: [] }] : [])
      ]
    }
  };
}

export function tableRows(body) {
  if (body.table === "rammarket")
    return [{ supply: "10000000000.0000 RAMCORE", base: { balance: "68719476736 RAM" }, quote: { balance: "2450000.0000 SYS" } }];
  if (body.table === "prices") return [{ pair: "sysusd", latest_rate: { price: "0.8425 USD", timestamp: timestamp(0) } }];
  if (body.table === "stat") {
    const symbol = body.code === "seed.token" ? "SEED" : "SYS";
    return [{ supply: `451250000.0000 ${symbol}`, max_supply: `1000000000.0000 ${symbol}`, issuer: "eosio" }];
  }
  if (body.table === "vaults")
    return Array.from({ length: 8 }, (_, index) => ({
      id: (9007199254740992n + BigInt(index)).toString(),
      owner: accountNames[index],
      balance: `${(6000 + index * 324.5).toFixed(4)} SYS`,
      status: index % 3 ? "active" : "locked"
    }));
  if (body.table === "accounts") return [{ balance: "84250.1250 SYS" }, { balance: "12500.0000 SEED" }, { balance: "4680.5000 USDT" }];
  return [];
}

export function histogram(query) {
  const interval = query.get("interval") || "1h";
  const step =
    { "1m": 60000, "5m": 300000, "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000, "1w": 604800000, "1M": 2592000000 }[
      interval
    ] || 3600000;
  const end = query.has("before") ? Date.parse(query.get("before")) : Date.UTC(2026, 9, 21, 12);
  const start = query.has("after") ? Date.parse(query.get("after")) : end - 47 * step;
  const scope = query.get("scope") || "sysusd";
  const buckets = Array.from({ length: 48 }, (_, index) => {
    const price = Math.round((scope === "seedusd" ? 1200 : 8200) + index * 8 + Math.sin(index * 0.5) * 160);
    return {
      timestamp: new Date(end - (47 - index) * step).toISOString(),
      doc_count: 12,
      average_price: price,
      median_price: price - 2,
      min_price: price - 45,
      max_price: price + 48
    };
  }).filter(bucket => Date.parse(bucket.timestamp) >= start);
  return {
    query_time_ms: 3,
    scope,
    contract: "oracle",
    table: "prices",
    interval,
    total_documents: { value: buckets.length * 12 },
    time_range: { from: buckets[0]?.timestamp, to: buckets.at(-1)?.timestamp },
    histogram: buckets
  };
}
