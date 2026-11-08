import { TestBed } from "@angular/core/testing";
import { HttpTestingController } from "@angular/common/http/testing";
import { vi } from "vitest";

import { ChainService, LIVE_HEAD_INTERVAL_MS, LIVE_HEAD_RETRY_MS } from "./chain.service";
import { DataService } from "./data.service";

describe("ChainService", () => {
  let service: ChainService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChainService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
  it("uses newer HTTP finality after a live connection stops advancing", () => {
    const service = TestBed.inject(ChainService);
    service.chainInfoResource.set({ last_irreversible_block_num: 125 } as any);
    service.streamLib.set(101);
    expect(service.lastIrreversibleBlockNum()).toBe(125);
    service.streamLib.set(130);
    expect(service.lastIrreversibleBlockNum()).toBe(130);
  });

  describe("live head", () => {
    let http: HttpTestingController;
    const liveRequests = () => http.match(request => request.url === "https://chain.example/v1/chain/get_info");
    beforeEach(async () => {
      vi.useFakeTimers();
      TestBed.inject(DataService).setOrigin("https://chain.example");
      http = TestBed.inject(HttpTestingController);
      service.chainInfoResource.set({ head_block_num: 1 } as any);
      await vi.advanceTimersByTimeAsync(0);
      http.match(() => true).forEach(request => request.flush({}));
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("polls quietly, backs off while the API fails, and stops with its last viewer", async () => {
      const stop = service.startLiveHead();
      await vi.advanceTimersByTimeAsync(LIVE_HEAD_INTERVAL_MS);
      const [first] = liveRequests();
      first.flush({ head_block_num: 500, last_irreversible_block_num: 498, head_block_producer: "alice", server_version: "v" });
      await vi.advanceTimersByTimeAsync(0);
      expect(service.headBlockNum()).toBe(500);
      expect(service.chainInfoResource.isLoading()).toBe(false);
      expect(service.liveFailedAt()).toBeNull();

      await vi.advanceTimersByTimeAsync(LIVE_HEAD_INTERVAL_MS);
      liveRequests()[0].flush({ code: 503 }, { status: 503, statusText: "Service Unavailable" });
      await vi.advanceTimersByTimeAsync(0);
      expect(service.liveFailedAt()).not.toBeNull();
      expect(service.headBlockNum()).toBe(500);
      await vi.advanceTimersByTimeAsync(LIVE_HEAD_INTERVAL_MS);
      expect(liveRequests()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(LIVE_HEAD_RETRY_MS - LIVE_HEAD_INTERVAL_MS);
      liveRequests()[0].flush({ head_block_num: 520, last_irreversible_block_num: 518 });
      await vi.advanceTimersByTimeAsync(0);
      expect(service.liveFailedAt()).toBeNull();
      expect(service.headBlockNum()).toBe(520);

      stop();
      stop();
      await vi.advanceTimersByTimeAsync(LIVE_HEAD_RETRY_MS);
      expect(liveRequests()).toHaveLength(0);
    });

    it("skips polls while the page is hidden", async () => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      const stop = service.startLiveHead();
      await vi.advanceTimersByTimeAsync(LIVE_HEAD_INTERVAL_MS * 3);
      expect(liveRequests()).toHaveLength(0);
      stop();
    });
  });
});
