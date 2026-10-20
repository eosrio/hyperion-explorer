import { TestBed } from "@angular/core/testing";
import { HttpTestingController } from "@angular/common/http/testing";
import { vi } from "vitest";
import { AccountService } from "./account.service";
import { DataService } from "./data.service";

const stream = vi.hoisted(() => ({
  created: vi.fn(),
  stop: vi.fn(),
  on: vi.fn()
}));
vi.mock("@eosrio/hyperion-stream-client", () => ({
  HyperionStreamClient: class {
    online = true;
    constructor(options: unknown) {
      stream.created(options);
    }
    async connect() {}
    on() {}
    async streamActions() {
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
});
