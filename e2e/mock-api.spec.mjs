import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { HyperionStreamClient } from "@eosrio/hyperion-stream-client";
import { createFixture } from "./mock-server.mjs";
import { publicKey, txId } from "./mock-chain.mjs";

test("offline API and actual published streaming client", { timeout: 15000 }, async t => {
  const fixture = createFixture({ port: 0 });
  fixture.server.listen(0, "127.0.0.1");
  await once(fixture.server, "listening");
  const origin = `http://127.0.0.1:${fixture.server.address().port}`;
  const request = async (path, body) => {
    const response = await fetch(
      origin + path,
      body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined
    );
    assert.equal(response.status, 200, path);
    return response.json();
  };
  const client = new HyperionStreamClient({ endpoint: origin, libMonitor: false });
  try {
    await t.test("all page contracts have useful, consistent data", async () => {
      const profile = await request("/v2/state/get_account?account=eosio");
      assert.equal(profile.total_actions, 72);
      assert.equal(profile.actions.length, 20);
      assert.equal(profile.account.permissions.length, 3);
      assert.equal(profile.tokens.length, 2);
      assert.equal(typeof profile.actions[0].global_sequence, "string");
      const tx = await request(`/v2/history/get_transaction?id=${txId}`);
      assert.equal(tx.actions[0].trx_id, profile.actions[0].trx_id);
      const block = await request("/v1/trace_api/get_block", { block_num: 100 });
      assert.ok(block.transactions.some(row => row.id === txId));
      assert.equal((await request("/v1/trace_api/get_block", { block_id: block.previous_id })).number, 99);
      assert.equal((await request(`/v2/state/get_key_accounts?public_key=${publicKey}`)).permissions.length, 3);
      assert.ok((await request("/v1/chain/get_producers", { json: true })).rows.length >= 21);
      assert.equal((await request("/v2/oracle/get_datapoints_histogram?scope=sysusd&interval=1h")).histogram.length, 48);
      assert.equal((await request("/v2/state/get_top_holders?contract=eosio.token&symbol=SYS")).holders.length, 10);
      const abi = await request("/v1/chain/get_abi", { account_name: "vault.defi" });
      assert.ok(abi.abi.tables.some(table => table.name === "vaults"));
      assert.ok((await request("/v1/chain/get_table_by_scope", { code: "eosio.token", table: "accounts", limit: 3 })).more);
      assert.equal(
        (await request("/v1/chain/get_table_rows", { code: "vault.defi", table: "vaults", scope: "vault.defi" })).rows[0].id,
        "9007199254740992"
      );
    });
    await t.test("filters, order and exact snapshot bounds affect the returned actions", async () => {
      const page = await request(
        "/v2/history/get_actions?account=eosio&act.account=eosio.token&act.name=transfer&global_sequence=0-9007199254741094&limit=2"
      );
      assert.equal(page.actions.length, 2);
      assert.ok(page.actions.every(row => row.act.account === "eosio.token" && BigInt(row.global_sequence) <= 9007199254741094n));
      const ascending = await request("/v2/history/get_actions?account=eosio&sort=asc&limit=2");
      assert.ok(BigInt(ascending.actions[0].global_sequence) < BigInt(ascending.actions[1].global_sequence));
    });
    await t.test("empty, themed and retryable failure scenarios are controllable", async () => {
      await request("/__fixture/state", { theme: "dark", accountUnavailable: true });
      assert.equal((await fetch(origin + "/v2/state/get_account?account=eosio")).status, 503);
      const metadata = await request("/v2/explorer_metadata");
      assert.equal(metadata.theme["--main-background"], "#172330");
      await request("/__fixture/state", { emptyAccount: true });
      const empty = await request("/v2/state/get_account?account=eosio");
      assert.equal(empty.actions.length, 0);
      assert.equal(empty.tokens.length, 0);
      await request("/__fixture/state", { manualStreaming: true });
    });
    await t.test("delivers string sequences and LIB updates, reconnects, and cancels subscriptions", async () => {
      const irreversibleBlocks = [];
      client.on("libUpdate", message => irreversibleBlocks.push(message.block_num));
      await client.connect();
      const stream = await client.streamActions({ account: "eosio", start_from: 101, read_until: 0 });
      const messages = [];
      stream.on("message", message => messages.push(message));
      // history_end must release the client's live queue before the test emits.
      await new Promise(resolve => setTimeout(resolve, 60));
      const emitted = await request("/__fixture/stream", { event: "emit" });
      assert.equal(emitted.action.global_sequence, "9007199254741101");
      await until(() => messages.length === 1);
      assert.equal(messages[0].content.global_sequence, "9007199254741101");
      const firstUUID = stream.reqUUID;
      await request("/__fixture/stream", { event: "disconnect" });
      await until(() => stream.reqUUID !== firstUUID && client.online);
      await request("/__fixture/stream", { event: "emit" });
      await until(() => messages.some(message => message.content.global_sequence === "9007199254741102"));
      await until(() => irreversibleBlocks.includes(102));
      stream.stop();
      await until(async () => (await request("/__fixture/state")).connectedStreams === 0);
    });
  } finally {
    client.disconnect();
    fixture.close();
  }
});

async function until(check) {
  const deadline = Date.now() + 6000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for the mock stream");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
