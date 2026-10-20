import { createServer, request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";

const chainId = "a".repeat(64);
const txId = "f".repeat(64);
const time = "2026-10-20T06:00:00.000";
const requests = [];
let state = {};
const action = {
  "@timestamp": time,
  timestamp: time,
  block_num: 100,
  block_id: "b".repeat(64),
  trx_id: txId,
  global_sequence: 100,
  receiver: "eosio.token",
  act: {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: "eosio", permission: "active" }],
    data: { from: "eosio", to: "alice", quantity: "1.0000 SYS", memo: "Fixture transfer" }
  },
  cpu_usage_us: 50,
  net_usage_words: 10,
  notified: ["eosio", "alice"]
};
const account = {
  account_name: "eosio",
  core_liquid_balance: "10.0000 SYS",
  permissions: [],
  privileged: false,
  cpu_limit: { used: 1, max: 100 },
  net_limit: { used: 1, max: 100 },
  ram_quota: 8192,
  ram_usage: 1024,
  last_code_update: "1970-01-01T00:00:00.000",
  total_resources: { cpu_weight: "1.0000 SYS", net_weight: "1.0000 SYS" },
  self_delegated_bandwidth: { cpu_weight: "1.0000 SYS", net_weight: "1.0000 SYS" },
  voter_info: { producers: [], proxy: "" }
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:17000");
  if (url.pathname.startsWith("/explorer")) {
    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port: 17001,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "x-hyperion-server": "http://127.0.0.1:17000" }
      },
      response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      }
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("Explorer unavailable");
    });
    req.pipe(upstream);
    return;
  }
  res.setHeader("Content-Type", "application/json");
  const send = (data, status = 200) => {
    res.writeHead(status);
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/__fixture/state") {
    let body = "";
    for await (const chunk of req) body += chunk;
    state = body ? JSON.parse(body) : {};
    requests.length = 0;
    return send(state);
  }
  if (url.pathname === "/__fixture/requests") return send(requests);
  requests.push({ method: req.method, path: url.pathname });
  if (url.pathname === "/v2/explorer_logo") {
    res.setHeader("Content-Type", "image/svg+xml");
    return res.end(await readFile(new URL("../src/assets/logo-hyperion-horz.svg", import.meta.url)));
  }
  if (url.pathname === "/v2/explorer_metadata") {
    if (state.metadataUnavailable) return send({ message: "Projection recovering" }, 503);
    // No indexed-block watermark: identity must suffice for explorer bootstrap.
    return send({
      chain_id: chainId,
      chain_name: "Fixture Chain",
      provider: "Local fixture",
      provider_url: "https://example.com",
      theme: {},
      oracle_price_historgram: false
    });
  }
  if (url.pathname === "/v1/chain/get_info")
    return send({
      chain_id: chainId,
      head_block_num: 102,
      last_irreversible_block_num: 101,
      head_block_time: time,
      head_block_producer: "eosio",
      server_version: "fixture",
      server_version_string: "4.5 fixture"
    });
  if (url.pathname === "/v2/state/get_account") {
    if (state.accountUnavailable) return send({ message: "Projection recovering" }, 503);
    return send({ account, actions: [action], tokens: [], total_actions: 1, links: [] });
  }
  if (url.pathname === "/v2/history/get_actions") {
    if (state.actionsUnavailable) return send({ message: "History unavailable" }, 503);
    return send({ actions: [action], total: { value: 1, relation: "eq" }, lib: 101 });
  }
  if (url.pathname === "/v2/history/get_transaction") {
    if (state.transactionUnavailable) return send({ message: "History unavailable" }, 503);
    return send({ actions: [action], lib: 101, executed: true });
  }
  if (url.pathname === "/v2/state/get_key_accounts") return send({ account_names: ["eosio"], permissions: [] });
  if (url.pathname === "/v2/history/get_creator") return send({ creator: "eosio", timestamp: time });
  if (url.pathname === "/v1/trace_api/get_block")
    return send({
      number: 100,
      id: "b".repeat(64),
      previous_id: "c".repeat(64),
      next_id: "d".repeat(64),
      producer: "eosio",
      timestamp: time,
      transactions: [
        {
          id: txId,
          actions: [{ account: "eosio.token", action: "transfer", data: action.act.data, authorization: action.act.authorization }]
        }
      ]
    });
  if (url.pathname === "/v2/history/get_deltas") {
    if (state.deltasUnavailable) return send({ message: "Delta history unavailable" }, 503);
    return send({ deltas: [], total: { value: 0, relation: "eq" } });
  }
  if (url.pathname === "/v1/chain/get_table_by_scope") return send({ rows: [{ scope: "eosio" }], more: "" });
  if (url.pathname === "/v1/chain/get_table_rows") return send({ rows: [], more: false });
  if (url.pathname === "/v1/chain/get_producers") return send({ rows: [], total_producer_vote_weight: "0", more: "" });
  send({ message: `Missing API fixture: ${url.pathname}` }, 404);
}).listen(17000, "127.0.0.1", () => console.log("Hyperion API fixture listening on 17000"));
