import { TestBed } from "@angular/core/testing";
import { HttpTestingController } from "@angular/common/http/testing";
import { ChainAnalyticsService } from "./chain-analytics.service";
import { DataService } from "./data.service";

describe("ChainAnalyticsService", () => {
  let service: ChainAnalyticsService;
  let http: HttpTestingController;
  const call = (method: "loadDay" | "loadRotation" | "loadActivity" | "loadRibbon" | "loadHealth") =>
    (service as unknown as Record<string, () => Promise<void>>)[method]();
  const flushMatching = (fragment: string, body: object, status = 200) =>
    http.match(request => request.url.includes(fragment)).forEach(request =>
      status === 200 ? request.flush(body) : request.flush(body, { status, statusText: "Error" })
    );
  /** Let each awaited request reach the controller before answering it. */
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.inject(DataService).setOrigin("https://chain.example");
    service = TestBed.inject(ChainAnalyticsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    // The chain service loads chain info and producers on its own; those are not under test here.
    http.match(request => request.url.includes("/v1/chain/")).forEach(request => request.flush({ rows: [] }));
    http.verify({ ignoreCancelled: true });
  });

  it("counts real transactions from hourly buckets and keeps the onblock-inclusive figure apart", async () => {
    const done = call("loadDay");
    await settle();
    const hours: Record<string, { trx_count: number }> = {};
    for (let hour = 0; hour < 26; hour++) hours[`2026-11-08T${String(hour % 24).padStart(2, "0")}:00:00.000Z${hour >= 24 ? "+" : ""}`] = { trx_count: 10 };
    flushMatching("get_trx_count", { grouped_stats: hours });
    flushMatching("get_action_usage", { action_count: "500", tx_count: 400, unique_actors: 7 });
    flushMatching("after=", { total: { value: 2 } });
    flushMatching("act.name=newaccount", { total: { value: 10000, relation: "gte" } });
    await done;
    const day = service.day()!;
    expect(day.hourly).toHaveLength(24);
    expect(day.transactions).toBe(240);
    expect(day.transactionsWithOnblock).toBe(400);
    expect(day.actions).toBe(500);
    expect(day.activeAccounts).toBe(7);
    expect(day.newAccounts).toBe(2);
    expect(day.accountsTotal).toEqual({ value: 10000, capped: true });
  });

  it("falls back to usage counts on an API without get_trx_count", async () => {
    const done = call("loadDay");
    await settle();
    flushMatching("get_trx_count", { message: "Route not found" }, 404);
    flushMatching("get_action_usage", { action_count: 90, tx_count: 30 });
    flushMatching("act.name=newaccount", { total: { value: 0 } });
    await done;
    const day = service.day()!;
    expect(day.transactions).toBeNull();
    expect(day.hourly).toEqual([]);
    expect(day.transactionsWithOnblock).toBe(30);
    expect(day.activeAccounts).toBeNull();
  });

  it("hides the rotation when producers cannot be grouped", async () => {
    const done = call("loadRotation");
    await settle();
    flushMatching("group_by=producer", {}, 404);
    flushMatching("get_missed_blocks", { events: [] });
    await done;
    expect(service.rotation()).toBeNull();
  });

  it("reads the producer rotation and missed blocks", async () => {
    const done = call("loadRotation");
    await settle();
    flushMatching("group_by=producer", { grouped_stats: { bob: { block_count: 359 }, alice: { block_count: 361 } } });
    flushMatching("get_missed_blocks", { events: [{}, {}] });
    await done;
    expect(service.rotation()).toEqual({
      producers: [
        { name: "alice", blocks: 361 },
        { name: "bob", blocks: 359 }
      ],
      missedBlocks24h: 2
    });
  });

  it("ranks the recent action mix by share", async () => {
    const done = call("loadActivity");
    await settle();
    const act = (account: string, name: string) => ({ act: { account, name } });
    flushMatching("act.name=!onblock", { actions: [act("a", "x"), act("a", "x"), act("a", "x"), act("b", "y")] });
    await done;
    expect(service.activity()).toEqual([
      { contract: "a", action: "x", share: 0.75 },
      { contract: "b", action: "y", share: 0.25 }
    ]);
  });

  it("settles a panel after its first answer, even a failed one, so its placeholder gives the space back", async () => {
    const settle = (service as unknown as { settle: (panel: string, load: () => Promise<void>) => Promise<void> }).settle.bind(service);
    expect(service.settled().activity).toBe(false);
    await settle("activity", () => Promise.reject(new Error("unsupported"))).catch(() => undefined);
    expect(service.settled().activity).toBe(true);
    expect(service.settled().day).toBe(false);
  });

  it("orders the ribbon oldest first and reads index health", async () => {
    const ribbon = call("loadRibbon");
    await settle();
    flushMatching("get_blocks", { blocks: [{ block_num: 12, trx_count: 2, producer: "p" }, { block_num: 11, producer: "q" }] });
    await ribbon;
    expect(service.ribbon()).toEqual([
      { num: 11, trx: 0, producer: "q" },
      { num: 12, trx: 2, producer: "p" }
    ]);
    const health = call("loadHealth");
    await settle();
    flushMatching("/v2/health", {
      version: "4.0.7",
      health: [{ service: "Elasticsearch", service_data: { total_indexed_blocks: 100, missing_blocks: 3, missing_pct: "3.00%" } }]
    });
    await health;
    expect(service.health()).toEqual({ version: "4.0.7", indexedBlocks: 100, missingBlocks: 3, missingPct: "3.00%" });
  });
});
