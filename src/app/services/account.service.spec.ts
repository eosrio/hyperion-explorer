import { TestBed } from "@angular/core/testing";
import { HttpTestingController } from "@angular/common/http/testing";
import { vi } from "vitest";
import { AccountService } from "./account.service";
import { DataService } from "./data.service";
import { historyAction } from "../sequences";

const stream = vi.hoisted(() => ({
  created: vi.fn(),
  stop: vi.fn(),
  on: vi.fn(),
  requested: vi.fn()
}));
vi.mock("@eosrio/hyperion-stream-client", () => ({
  HyperionStreamClient: class {
    online = true;
    constructor(options: unknown) {
      stream.created(options);
    }
    async connect() {}
    on() {}
    async streamActions(params: unknown) {
      stream.requested(params);
      return { requestHash: "fixture", stop: stream.stop, on: stream.on };
    }
  }
}));

describe("AccountService compatibility", () => {
  let service: AccountService;
  let data: DataService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    vi.clearAllMocks();
    data = TestBed.inject(DataService);
    data.setOrigin("https://chain.example");
    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));

  const rawAction = (global_sequence: unknown, receiver = "alice") => ({
    global_sequence,
    receiver,
    trx_id: "f".repeat(64),
    block_num: 100,
    act: { data: {} }
  });
  const rows = (...values: string[]) => values.map(value => historyAction(rawAction(value)));
  const seed = (...values: string[]) => {
    service.accountName.set("alice");
    service.accountDataRes.set({ actions: rows(...values), total_actions: values.length } as any);
  };
  const message = () => stream.on.mock.calls.find(call => call[0] === "message")![1];

  async function settle() {
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.tick();
  }
  async function loadAccount(values: unknown[]) {
    service.accountName.set("alice");
    TestBed.tick();
    http
      .expectOne("https://chain.example/v2/state/get_account?account=alice")
      .flush({ actions: values.map(value => rawAction(value)), total_actions: 50, tokens: [], account: {} });
    http
      .match(request => request.url.includes("/v1/chain/"))
      .forEach(request => request.flush({ rows: [], last_irreversible_block_num: 101 }));
    await settle();
    await settle();
  }

  it.each(["", "wss://stream.example"])("uses the deployment stream endpoint with override %s", async override => {
    data.env.streamApiUrl = override;
    await service.startActionStream();
    expect(stream.created).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: override || "https://chain.example",
        debug: false
      })
    );
  });

  it("exposes transaction unavailability and clears it when the request recovers", async () => {
    const first = service.loadTxData("f".repeat(64));
    http
      .expectOne("https://chain.example/v2/history/get_transaction?id=" + "f".repeat(64))
      .flush({ message: "Projection recovering" }, { status: 503, statusText: "Service Unavailable" });
    expect(await first).toBeNull();
    expect(service.requestError()).toContain("temporarily unavailable");
    expect(service.loaded()).toBe(true);
    const retry = service.loadTxData("f".repeat(64));
    http.expectOne("https://chain.example/v2/history/get_transaction?id=" + "f".repeat(64)).flush({ actions: [] });
    expect(await retry).toEqual({ actions: [] });
    expect(service.requestError()).toBeNull();
  });

  it("encodes public keys in query parameters", async () => {
    const result = service.loadPubKey("PUB_R1_fixture+key");
    http
      .expectOne("https://chain.example/v2/state/get_key_accounts?public_key=PUB_R1_fixture%2Bkey&details=true")
      .flush({ account_names: [] });
    expect(await result).toEqual({ account_names: [] });
  });

  it("preserves transaction receipt/auth metadata and rejects already rounded numbers", async () => {
    const id = "f".repeat(64);
    const pending = service.loadTxData(id);
    http
      .expectOne(request => request.url.includes("get_transaction"))
      .flush({
        actions: [
          {
            ...rawAction("18446744073709551615"),
            receipts: [{ recv_sequence: "9223372036854775808", auth_sequence: [["alice", "9007199254740993"]] }]
          }
        ]
      });
    const result = await pending;
    expect(result.actions[0].global_sequence).toBe("18446744073709551615");
    expect(result.actions[0].receipts[0].auth_sequence[0][1]).toBe("9007199254740993");
    const invalid = service.loadTxData(id);
    http.expectOne(request => request.url.includes("get_transaction")).flush({ actions: [rawAction(2 ** 53)] });
    expect(await invalid).toBeNull();
    expect(service.requestError()).toContain("unsafe numeric values cannot be recovered");
  });

  it("uses an exact descending cursor and appends to the displayed history", async () => {
    seed("18446744073709551615", "9007199254740993");
    const pending = service.loadMoreActions();
    const request = http.expectOne(request => request.url.includes("get_actions"));
    expect(new URL(request.request.url).searchParams.get("global_sequence")).toBe("0-9007199254740992");
    expect(service.loadingMoreActions()).toBe(true);
    await service.loadMoreActions(); // A repeated click must not start another request.
    request.flush({ actions: [rawAction("9007199254740992"), rawAction("9007199254740991")] });
    await pending;
    expect(service.actionsComputed().map(action => action.global_sequence)).toEqual([
      "18446744073709551615",
      "9007199254740993",
      "9007199254740992",
      "9007199254740991"
    ]);
    expect(service.loadingMoreActions()).toBe(false);
  });

  it("keeps ascending continuation inside the exact snapshot bound and retains filters", async () => {
    seed("18446744073709551615");
    service.sortDirection.set("asc");
    service.customParams.set({ "act.name": "transfer" });
    service.actionsComputed.set(rows("9007199254740992"));
    const pending = service.loadMoreActions();
    const request = http.expectOne(request => request.url.includes("get_actions"));
    const params = new URL(request.request.url).searchParams;
    expect(params.get("global_sequence")).toBe("9007199254740993-18446744073709551615");
    expect(params.get("act.name")).toBe("transfer");
    expect(params.get("sort")).toBe("asc");
    request.flush({ actions: [rawAction("9223372036854775808"), rawAction("9007199254740993")] });
    await pending;
    expect(service.actionsComputed().map(action => action.global_sequence)).toEqual([
      "9007199254740992",
      "9007199254740993",
      "9223372036854775808"
    ]);
  });

  it("does not overflow the uint64 cursor or fetch for empty history", async () => {
    seed("18446744073709551615");
    service.sortDirection.set("asc");
    service.actionsComputed.set(rows("18446744073709551615"));
    await service.loadMoreActions();
    service.actionsComputed.set([]);
    await service.loadMoreActions();
    http.expectNone(request => request.url.includes("get_actions"));
  });

  it("discards a continuation that finishes after the user changes history context", async () => {
    seed("9223372036854775808");
    const pending = service.loadMoreActions();
    const request = http.expectOne(request => request.url.includes("get_actions"));
    service.pageIndex.set(1);
    service.actionsComputed.set(rows("100"));
    request.flush({ actions: [rawAction("9223372036854775807")] });
    await pending;
    expect(service.actionsComputed().map(action => action.global_sequence)).toEqual(["100"]);
  });

  it("keeps valid rows visible and reports an invalid continuation", async () => {
    seed("9223372036854775808");
    const pending = service.loadMoreActions();
    http.expectOne(request => request.url.includes("get_actions")).flush({ actions: [rawAction(2 ** 63)] });
    await pending;
    expect(service.actionsComputed().map(action => action.global_sequence)).toEqual(["9223372036854775808"]);
    expect(service.historyError()).toContain("unsafe numeric values cannot be recovered");
    service.accountName.set("bob");
    expect(service.historyError()).toBeNull();
  });

  it("waits for the account snapshot, preserves page bounds, and caches exact identities", async () => {
    service.pageIndex.set(1);
    await loadAccount(["9007199254740993"]);
    const request = http.expectOne(request => request.url.includes("get_actions"));
    expect(new URL(request.request.url).searchParams.get("global_sequence")).toBe("0-9007199254740993");
    request.flush({ actions: [rawAction("9007199254740992")], total: { value: 50 } });
    await settle();
    expect(service.actionsComputed()[0].global_sequence).toBe("9007199254740992");
    service.pageIndex.set(0);
    await settle();
    await settle();
    service.pageIndex.set(1);
    await settle();
    await settle();
    http.expectNone(request => request.url.includes("get_actions"));
    expect(service.actionsComputed()[0].global_sequence).toBe("9007199254740992");
    expect(JSON.stringify([...service.queryCache])).toContain("0-9007199254740993");
    service.accountDataRes.set({ actions: rows("9007199254740992") } as any);
    await settle();
    const adjacent = http.expectOne(request => request.url.includes("get_actions"));
    expect(new URL(adjacent.request.url).searchParams.get("global_sequence")).toBe("0-9007199254740992");
    adjacent.flush({ actions: [] });
    await settle();
    expect(service.queryCache.size).toBe(2);
  });

  it("rejects an unsafe account snapshot before pagination can use it", async () => {
    service.pageIndex.set(1);
    await loadAccount([2 ** 53]);
    expect(service.accountDataRes.error()).toBeInstanceOf(Error);
    expect(service.firstGlobalSequence()).toBeNull();
    http.expectNone(request => request.url.includes("get_actions"));
  });

  it("deduplicates replay overlaps while preserving adjacent streamed sequences and block offsets", async () => {
    seed("9007199254740992");
    await service.startActionStream();
    expect(stream.requested).toHaveBeenCalledWith(expect.objectContaining({ start_from: 101, read_until: 0 }));
    message()({ content: rawAction("9007199254740993") });
    message()({ content: rawAction("9007199254740992") });
    message()({ content: rawAction("9007199254740993") });
    expect(service.actionsComputed().map(action => action.global_sequence)).toEqual(["9007199254740992"]);
    expect(service.pendingStreamCount()).toBe(1);
    service.showNewActions();
    expect(service.actionsComputed().map(action => action.global_sequence)).toEqual(["9007199254740993", "9007199254740992"]);
    expect(service.firstGlobalSequence()).toBe("9007199254740993");
    expect(service.totalActionCounter()).toBe(2);
    expect(service.pendingStreamCount()).toBe(0);
    expect(service.streamingActionsSize()).toBe(2);
    service.accountName.set("bob");
    message()({ content: rawAction("18446744073709551615") });
    expect(service.streamingActionsSize()).toBe(0);
  });

  it.each([10, 50])("applies queued rows to a %s-row latest page", async pageSize => {
    seed("9007199254740992");
    service.pageSize.set(pageSize);
    service.actionRes.set({ actions: rows("9007199254740992") } as any);
    await service.startActionStream();
    message()({ content: rawAction("9007199254740993") });
    expect(service.actionsComputed()[0].global_sequence).toBe("9007199254740992");
    service.showNewActions();
    expect(service.actionsComputed()[0].global_sequence).toBe("9007199254740993");
    expect(service.pageSize()).toBe(pageSize);
    expect(service.pendingStreamCount()).toBe(0);
  });

  it("applies the first streamed action to an empty account history", async () => {
    seed();
    await service.startActionStream();
    message()({ content: rawAction("9007199254740993") });
    expect(service.actionsComputed()).toEqual([]);
    service.showNewActions();
    expect(service.actionsComputed()[0].global_sequence).toBe("9007199254740993");
    expect(service.firstGlobalSequence()).toBe("9007199254740993");
  });

  it("stops streaming and surfaces unsafe receipt metadata", async () => {
    seed("9007199254740992");
    await service.toggleStreaming();
    message()({ content: { ...rawAction("9007199254740993"), receipts: [{ recv_sequence: 2 ** 53 }] } });
    expect(stream.stop).toHaveBeenCalled();
    expect(service.streamClientStatus()).toBe(false);
    expect(service.historyError()).toContain("receipts[0].recv_sequence");
    message()({ content: rawAction("18446744073709551615") }); // Queued messages after failure cannot mutate the stopped stream.
    expect(service.actionsComputed()[0].global_sequence).toBe("9007199254740992");
  });
});
