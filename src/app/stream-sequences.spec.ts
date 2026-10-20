import { ActionContent, HyperionStream } from "@eosrio/hyperion-stream-client";
import { vi } from "vitest";
import { historyAction, HistoryAction } from "./sequences";

describe("Published stream client wire compatibility", () => {
  it.each(["batch", "json", "binary"])("preserves uint64 text through the real %s decoder", async format => {
    const client = { debugLog: vi.fn(), emit: vi.fn(), lastReceivedBlockNum: 0 };
    const stream = new HyperionStream<ActionContent>(client as any, "action", { account: "alice", start_from: 0 });
    const received: HistoryAction[] = [];
    stream.on("message", message => received.push(historyAction(message.content)));
    const actions = ["9007199254740992", "9007199254740993", "9223372036854775808", "18446744073709551615"].map(global_sequence => ({
      global_sequence,
      block_num: 100,
      trx_id: "f".repeat(64),
      receipts: [{ recv_sequence: "9223372036854775809", auth_sequence: [["alice", "18446744073709551615"]] }],
      act: { account: "eosio.token", name: "transfer", data: {} }
    }));
    if (format === "batch") {
      stream.handleIncomingMessage({ type: "action_trace", mode: "history", messages: JSON.parse(JSON.stringify(actions)) } as any);
    } else {
      for (const action of actions) {
        const json = JSON.stringify(action);
        stream.handleIncomingMessage({
          type: "action_trace",
          mode: "live",
          message: format === "json" ? json : new TextEncoder().encode(json)
        } as any);
      }
    }
    await vi.waitFor(() => expect(received).toHaveLength(4));
    expect(received.map(action => action.global_sequence)).toEqual(actions.map(action => action.global_sequence));
    expect(received.every(action => action["receipts"][0].auth_sequence[0][1] === "18446744073709551615")).toBe(true);
    expect(JSON.parse(JSON.stringify(received))).toEqual(actions);
    expect(client.lastReceivedBlockNum).toBe(100);
  });
});
