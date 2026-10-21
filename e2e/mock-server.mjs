import { createServer, request as httpRequest } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  account,
  blockId,
  accountNames,
  action,
  abi,
  chainId,
  filterActions,
  hash,
  histogram,
  history,
  producers,
  publicKey,
  tableRows,
  themes,
  timestamp,
  txId
} from "./mock-chain.mjs";

export function createFixture({ port = 17000, ssrPort = 17001 } = {}) {
  const origin = `http://127.0.0.1:${port}`;
  const requests = [];
  let state = {};
  let head = 102;
  let liveIndex = 0;
  let liveActions = [];
  const subscriptions = new Map();
  const allActions = () => [...liveActions, ...history(state)];
  const lib = () => Math.max(101, head - 2);
  const currentChainId = () => (state.theme && themes[state.theme] && state.theme !== "default" ? hash(`chain:${state.theme}`) : chainId);
  const sendLive = () => {
    if (!subscriptions.size || state.streamingPaused) return null;
    const next = BigInt(state.sequences?.[0] || "9007199254741100") + BigInt(++liveIndex);
    if (next > 18446744073709551615n) return null;
    const row = action(0, {
      global_sequence: next.toString(),
      block_num: ++head,
      block_id: blockId(head),
      trx_id: hash(`live-tx:${liveIndex}`),
      timestamp: timestamp(liveIndex),
      "@timestamp": timestamp(liveIndex)
    });
    row.act = {
      ...row.act,
      data: { ...row.act.data, quantity: `${(8 + liveIndex * 0.25).toFixed(4)} SYS`, memo: `Live transfer ${liveIndex} · local stream` }
    };
    row.receipts = [{ ...row.receipts[0], global_sequence: row.global_sequence }];
    liveActions.unshift(row);
    liveActions = liveActions.slice(0, 500);
    for (const { socket, request, reqUUID } of subscriptions.values()) {
      if (request.account && !row.notified.includes(request.account) && row.receiver !== request.account) continue;
      socket.emit("message", { type: "action_trace", mode: "live", reqUUID, message: JSON.stringify(row) });
    }
    io.emit("lib_update", { block_num: lib(), block_id: blockId(lib()), timestamp: timestamp(liveIndex - 2) });
    return row;
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    const send = (data, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    };
    try {
      if (url.pathname.startsWith("/explorer")) {
        const upstream = httpRequest(
          {
            hostname: "127.0.0.1",
            port: ssrPort,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, "x-hyperion-server": origin }
          },
          response => {
            res.writeHead(response.statusCode, response.headers);
            response.pipe(res);
          }
        );
        upstream.on("error", () => send({ message: "Explorer unavailable; build and start the SSR preview." }, 502));
        req.pipe(upstream);
        return;
      }
      let body = {};
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 65536) return send({ message: "Fixture payload too large" }, 413);
        }
        body = raw ? JSON.parse(raw) : {};
      }
      if (url.pathname === "/__fixture/state") {
        if (req.method === "POST") {
          state = body;
          head = 102;
          liveIndex = 0;
          liveActions = [];
          requests.length = 0;
          subscriptions.clear();
          io.disconnectSockets(true);
        }
        return send({ ...state, connectedStreams: subscriptions.size, head, lib: lib() });
      }
      if (url.pathname === "/__fixture/requests") return send(requests);
      if (url.pathname === "/__fixture/scenarios")
        return send({
          account: "eosio",
          accounts: accountNames,
          block: 100,
          transaction: txId,
          publicKey,
          contract: "eosio.token",
          table: "accounts",
          scope: "alice",
          holderSymbol: "SYS",
          themes: Object.keys(themes)
        });
      if (url.pathname === "/__fixture/stream" && req.method === "POST") {
        if (body.event === "emit") return send({ action: sendLive(), subscriptions: subscriptions.size });
        if (body.event === "pause" || body.event === "resume") state.streamingPaused = body.event === "pause";
        else if (body.event === "disconnect") for (const socket of io.sockets.sockets.values()) socket.conn.close();
        else if (body.event === "fork") io.emit("fork_event", { starting_block: head - 1, ending_block: head, new_id: hash("fork") });
        else if (body.event === "lib") io.emit("lib_update", { block_num: head, block_id: blockId(head), timestamp: timestamp(liveIndex) });
        return send({ event: body.event, subscriptions: subscriptions.size });
      }
      requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
      if (requests.length > 1000) requests.shift();
      if (state.latencyMs) await new Promise(resolve => setTimeout(resolve, Math.min(3000, Math.max(0, state.latencyMs))));
      const unavailable = (flag, message) => (state[flag] ? (send({ message }, 503), true) : false);
      if (url.pathname === "/v2/explorer_logo") {
        res.writeHead(200, { "Content-Type": "image/svg+xml" });
        if (state.theme && state.theme !== "default") {
          const dark = state.theme === "dark";
          return res.end(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 70"><path d="M5 40h15l9-27 7 44 11-33 6 16h18" fill="none" stroke="${dark ? "#7acbff" : "#216a54"}" stroke-width="4"/><text x="83" y="46" font-family="sans-serif" font-size="28" font-weight="700" fill="${dark ? "#e4edf7" : "#172c24"}">${dark ? "NIGHTFALL" : "CANOPY"}</text></svg>`
          );
        }
        return res.end(await readFile(new URL("../src/assets/logo-hyperion-horz.svg", import.meta.url)));
      }
      if (url.pathname === "/v2/explorer_metadata") {
        if (unavailable("metadataUnavailable", "Metadata temporarily unavailable")) return;
        return send({
          chain_id: currentChainId(),
          chain_name: state.theme === "forest" ? "Canopy Testnet" : state.theme === "dark" ? "Nightfall Testnet" : "Fixture Chain",
          provider: "Local fixture",
          provider_url: "https://example.com",
          theme: themes[state.theme] || {},
          oracle_price_historgram: !state.disableOracle,
          oracle: { contract: "oracle", table: "prices", pair: "sysusd" }
        });
      }
      if (url.pathname === "/v1/chain/get_info")
        return send({
          chain_id: currentChainId(),
          head_block_num: head,
          last_irreversible_block_num: lib(),
          head_block_id: blockId(head),
          last_irreversible_block_id: blockId(lib()),
          head_block_time: timestamp(liveIndex + 4),
          head_block_producer: "harborbp",
          server_version: "fixture",
          server_version_string: "4.5 local fixture",
          virtual_block_cpu_limit: 200000000,
          virtual_block_net_limit: 1048576000,
          block_cpu_limit: 200000,
          block_net_limit: 1048576
        });
      if (url.pathname === "/v2/state/get_account") {
        if (unavailable("accountUnavailable", "Projection recovering")) return;
        const name = url.searchParams.get("account") || "eosio";
        const profile = account(name, name === "empty" || state.emptyAccount);
        if (!profile) return send({ message: "Account not found" }, 404);
        const actions =
          name === "empty" || state.emptyAccount
            ? []
            : filterActions(allActions(), new URLSearchParams({ account: name, limit: "1000" })).actions;
        const tokens =
          name === "empty" || state.emptyAccount
            ? []
            : [
                { contract: "seed.token", symbol: "SEED", precision: 4, amount: 12500 },
                { contract: "usd.token", symbol: "USDT", precision: 4, amount: 4680.5 }
              ];
        return send({
          account: profile,
          actions: actions.slice(0, state.initialActions ?? 20),
          tokens,
          total_actions: actions.length,
          links: [{ account: name, code: "eosio.token", type: "transfer", requirement: "active" }]
        });
      }
      if (url.pathname === "/v2/history/get_actions") {
        if (unavailable("actionsUnavailable", "History unavailable")) return;
        return send({ ...filterActions(allActions(), url.searchParams), lib: lib() });
      }
      if (url.pathname === "/v2/history/get_transaction") {
        if (unavailable("transactionUnavailable", "History unavailable")) return;
        const actions = allActions().filter(row => row.trx_id === url.searchParams.get("id"));
        return send({ actions, lib: lib(), executed: actions.length > 0, cached: false, query_time_ms: 2 });
      }
      if (url.pathname === "/v2/state/get_key_accounts") {
        if (unavailable("keyUnavailable", "Key history unavailable")) return;
        const found = url.searchParams.get("public_key") === publicKey;
        return send({
          account_names: found ? ["alice", "bob", "eosio"] : [],
          permissions: found ? ["alice", "bob", "eosio"].map(owner => ({ owner, name: "active" })) : []
        });
      }
      if (url.pathname === "/v2/history/get_creator") return send({ creator: "eosio", timestamp: "2021-04-15T09:24:11.000" });
      if (url.pathname === "/v1/trace_api/get_block") {
        if (unavailable("blockUnavailable", "Block history unavailable")) return;
        const number = body.block_id ? parseInt(body.block_id.slice(0, 8), 16) : Number(body.block_num || 100);
        if (!Number.isSafeInteger(number) || number < 1 || number > head || (body.block_id && body.block_id !== blockId(number)))
          return send({ message: "Block not found" }, 404);
        const rows = allActions().filter(row => row.block_num === number);
        return send({
          number,
          id: blockId(number),
          previous_id: blockId(number - 1),
          next_id: blockId(number + 1),
          producer: "harborbp",
          timestamp: timestamp((number - 100) * 2),
          transactions: rows.map(row => ({
            id: row.trx_id,
            cpu_usage_us: row.cpu_usage_us,
            net_usage_words: row.net_usage_words,
            status: "executed",
            actions: [
              {
                receiver: row.receiver,
                account: row.act.account,
                action: row.act.name,
                data: row.act.data,
                authorization: row.act.authorization
              }
            ]
          }))
        });
      }
      if (url.pathname === "/v2/history/get_deltas") {
        if (unavailable("deltasUnavailable", "Delta history unavailable")) return;
        const number = Number(url.searchParams.get("block_num") || 100);
        const deltas = state.emptyHistory
          ? []
          : ["alice", "bob"].map((scope, index) => ({
              timestamp: timestamp(0),
              present: index ? 0 : 1,
              code: "eosio.token",
              scope,
              table: "accounts",
              primary_key: (9007199254740993n + BigInt(index)).toString(),
              payer: scope,
              block_num: number,
              block_id: blockId(number),
              data: { balance: `${(4200 + index * 500).toFixed(4)} SYS` }
            }));
        return send({ deltas, total: { value: deltas.length, relation: "eq" }, query_time_ms: 2 });
      }
      if (url.pathname === "/v1/chain/get_abi") {
        if (unavailable("contractUnavailable", "Contract ABI unavailable")) return;
        return send(abi(body.account_name));
      }
      if (url.pathname === "/v1/chain/get_table_by_scope") {
        if (unavailable("contractUnavailable", "Contract scopes unavailable")) return;
        const scopes =
          body.table === "stat" ? ["SYS", "SEED"] : accountNames.filter(name => !body.lower_bound || name >= body.lower_bound).sort();
        const limit = Math.min(1000, Number(body.limit) || 30);
        return send({
          rows: scopes.slice(0, limit).map(scope => ({ code: body.code, table: body.table || "userres", scope, payer: scope, count: 3 })),
          more: scopes[limit] || ""
        });
      }
      if (url.pathname === "/v1/chain/get_table_rows") {
        if (unavailable("contractUnavailable", "Contract rows unavailable")) return;
        return send({ rows: state.emptyTables ? [] : tableRows(body), more: false, next_key: "" });
      }
      if (url.pathname === "/v2/state/get_voter_scopes")
        return send({ scopes: accountNames.filter(name => name.startsWith((url.searchParams.get("term") || "").replaceAll("*", ""))) });
      if (url.pathname === "/v1/chain/get_producers")
        return send({ rows: state.emptyProducers ? [] : producers, total_producer_vote_weight: "24500000000000000", more: "" });
      if (url.pathname === "/v2/state/get_top_holders") {
        if (unavailable("holdersUnavailable", "Token holders unavailable")) return;
        return send({
          holders: state.emptyHolders
            ? []
            : accountNames.slice(0, 10).map((owner, index) => ({ owner, amount: 1500000 / (index + 1) + index * 127.5 })),
          symbol: url.searchParams.get("symbol") || "SYS"
        });
      }
      if (url.pathname === "/v2/oracle/pairs")
        return send([
          { name: "sysusd", precision: 4 },
          { name: "seedusd", precision: 4 }
        ]);
      if (url.pathname.startsWith("/.internal/read_theme/")) {
        const file = `${decodeURIComponent(url.pathname.split("/").at(-1))}.theme.mjs`;
        const themeDirectory = new URL("../themes/", import.meta.url);
        if (!(await readdir(themeDirectory)).includes(file)) return send({ message: "Theme not found" }, 404);
        const context = {};
        runInNewContext(await readFile(new URL(file, themeDirectory), "utf8"), context);
        return send(context.themeData || {});
      }
      if (url.pathname === "/v2/oracle/get_datapoints_histogram") {
        if (unavailable("oracleUnavailable", "Price history unavailable")) return;
        return send(histogram(url.searchParams));
      }
      if (url.pathname === "/v2/health")
        return send({
          health: [{ service: "Mock chain", status: "OK" }],
          features: { streaming: { enable: true, traces: true, deltas: true } }
        });
      send({ message: `Missing API fixture: ${url.pathname}` }, 404);
    } catch (error) {
      if (!res.headersSent) send({ message: error.message }, 400);
    }
  });
  const io = new Server(server, { path: "/stream", serveClient: false });
  io.on("connection", socket => {
    socket.emit("handshake", { chain_id: currentChainId() });
    socket.emit("lib_update", { block_num: lib(), block_id: blockId(lib()), timestamp: timestamp(liveIndex) });
    socket.on("action_stream_request", (request, ack) => {
      const reqUUID = randomUUID();
      subscriptions.set(reqUUID, { socket, request, reqUUID });
      ack?.({ status: "OK", reqUUID });
      setTimeout(() => {
        if (!subscriptions.has(reqUUID)) return;
        const actions = allActions()
          .filter(row => row.block_num >= Number(request.start_from || head + 1))
          .slice(0, 20)
          .reverse();
        if (actions.length) socket.emit("message", { type: "action_trace", mode: "history", reqUUID, messages: actions });
        socket.emit("message", { type: "history_end", mode: "history", reqUUID });
      }, 30);
    });
    socket.on("cancel_stream_request", ({ reqUUID }, ack) => {
      subscriptions.delete(reqUUID);
      ack?.({ status: "OK" });
    });
    socket.on("reconnect", ({ last_id }) => socket.emit("resend_requests", { last_id }));
    socket.on("disconnect", () => {
      for (const [key, value] of subscriptions) if (value.socket === socket) subscriptions.delete(key);
    });
  });
  const ticker = setInterval(() => {
    if (!state.manualStreaming) sendLive();
  }, 2000);
  ticker.unref();
  server.on("close", () => clearInterval(ticker));
  return {
    server,
    io,
    close: () => {
      clearInterval(ticker);
      io.close();
      server.close();
    }
  };
}
