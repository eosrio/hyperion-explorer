import { TestBed } from "@angular/core/testing";
import { HttpTestingController } from "@angular/common/http/testing";
import { OracleService } from "./oracle.service";
import { DataService } from "./data.service";

describe("Oracle deployment endpoints", () => {
  let service: OracleService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    const data = TestBed.inject(DataService);
    data.setOrigin("https://chain.example");
    data.env.defaultTicker = "SYSUSD";
    service = TestBed.inject(OracleService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("loads pairs from the selected API, preserving supported response formats", async () => {
    const result = service.getPairs();
    http.expectOne("https://chain.example/v2/oracle/pairs").flush(["sysusd", { name: "btc", precision: 8 }]);
    expect(await result).toEqual([
      { name: "sysusd", precision: 4 },
      { name: "btc", precision: 8 }
    ]);
    expect(service.mainPair).toBe("sysusd");
  });
  it("loads price history from the selected API with encoded filters", async () => {
    const result = service.getPriceHistory("sysusd", "1h", "2026-10-20T00:00:00Z");
    const req = http.expectOne(request => request.url.startsWith("https://chain.example/v2/oracle/get_datapoints_histogram?"));
    expect(new URL(req.request.url).searchParams.get("after")).toBe("2026-10-20T00:00:00Z");
    req.flush({ histogram: [] });
    expect((await result).histogram).toEqual([]);
  });
});
