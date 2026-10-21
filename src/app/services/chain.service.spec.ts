import { TestBed } from "@angular/core/testing";

import { ChainService } from "./chain.service";

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
});
