import { TestBed } from "@angular/core/testing";
import { TransferState } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { vi } from "vitest";
import { DataServiceBrowser, DataServiceServer } from "./data.service";
import { ExplorerMetadata } from "../interfaces";

const metadata = { chain_id: "a".repeat(64), chain_name: "Fixture Chain", theme: { "--primary": "#0077aa" } };
const hydratedMetadata: ExplorerMetadata = {
  ...metadata,
  logo: "/v2/explorer_logo",
  provider: "Fixture",
  provider_url: "",
  custom_core_token: "",
  query_time_ms: 0,
  last_indexed_block: 0,
  last_indexed_block_time: ""
};

describe("Explorer metadata", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("accepts chain metadata before history progress is available and transfers it to the browser", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(metadata));
    const server = TestBed.inject(DataServiceServer);
    server.setOrigin("https://chain.example/explorer/");
    await server.load();
    expect(server.initError).toBeNull();
    expect(server.explorerMetadata()?.last_indexed_block).toBe(0);
    expect(server.explorerMetadata()?.logo).toBe("https://chain.example/v2/explorer_logo");
    expect(TestBed.inject(TransferState).get(server.metadataKey, null)?.chain_name).toBe("Fixture Chain");
    const browser = TestBed.inject(DataServiceBrowser);
    await browser.load();
    expect(TestBed.inject(Title).getTitle()).toBe("Fixture Chain Hyperion Explorer");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("accepts a genesis block and rejects responses without chain identity", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ...metadata, last_indexed_block: 1 }));
    const service = TestBed.inject(DataServiceServer);
    service.setOrigin("https://chain.example");
    await service.loadChainData();
    expect(service.explorerMetadata()?.last_indexed_block).toBe(1);
    request.mockResolvedValue(Response.json({ last_indexed_block: 100 }));
    await service.loadChainData();
    expect(service.explorerMetadata()).toBeNull();
    expect(service.initError).toContain("invalid explorer metadata");
  });

  it("keeps HTTP 503 retryable and clears the error after recovery", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    const service = TestBed.inject(DataServiceServer);
    service.setOrigin("https://chain.example");
    await service.load();
    expect(service.initError).toContain("temporarily unavailable");
    expect(TestBed.inject(TransferState).get(service.initErrorKey, "")).toContain("temporarily unavailable");
    request.mockResolvedValue(Response.json(metadata));
    await service.loadChainData();
    expect(service.initError).toBeNull();
  });

  it.each(["{broken", "null", "[]", '"old-theme"'])("ignores corrupt saved theme %s", async saved => {
    localStorage.setItem("theme-override", saved);
    const browser = TestBed.inject(DataServiceBrowser);
    TestBed.inject(TransferState).set(browser.metadataKey, hydratedMetadata);
    await browser.load();
    expect(browser.explorerMetadata()?.theme).toEqual(metadata.theme);
    expect(browser.initError).toBeNull();
  });

  it("merges valid CSS overrides with the deployment theme", async () => {
    localStorage.setItem("theme-override", JSON.stringify({ "--accent": "#ff6600" }));
    const browser = TestBed.inject(DataServiceBrowser);
    TestBed.inject(TransferState).set(browser.metadataKey, hydratedMetadata);
    await browser.load();
    expect(browser.explorerMetadata()?.theme).toEqual({ ...metadata.theme, "--accent": "#ff6600" });
  });

  it("rejects non-HTTP API origins", () => {
    expect(() => TestBed.inject(DataServiceServer).setOrigin("file:///tmp/explorer")).toThrow("HTTP or HTTPS");
  });
});
