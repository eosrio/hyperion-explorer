import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DataService } from './data.service';
import { DeltaService } from './delta.service';

describe('DeltaService', () => {
  let service: DeltaService;
  let http: HttpTestingController;
  const origin = 'https://chain.example';
  const url = origin + '/v2/history/get_deltas?block_num=100';

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.inject(DataService).setOrigin(origin);
    service = TestBed.inject(DeltaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ignoreCancelled: true}));
  async function settle() {
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.tick();
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('invalidates a cached empty result before retrying history', async () => {
    service.blockNum.set(100);
    TestBed.tick();
    http.expectOne(url).flush({deltas: []});
    await settle();
    expect(service.queryCache.get('block_num=100')).toEqual({deltas: []});
    service.reloadCurrentBlock();
    TestBed.tick();
    const fresh = {deltas: [{block_num: 100, table: 'assets'}]};
    http.expectOne(url).flush(fresh);
    await settle();
    expect(service.deltasResource.value()).toEqual(fresh);
    expect(service.queryCache.get('block_num=100')).toEqual(fresh);
  });

  it('does not recache an old response that resolves during invalidation', async () => {
    service.blockNum.set(100);
    TestBed.tick();
    http.expectOne(url).flush({deltas: []});
    service.reloadCurrentBlock();
    await settle();
    const fresh = {deltas: [{block_num: 100, table: 'assets'}]};
    http.expectOne(url).flush(fresh);
    await settle();
    expect(service.deltasResource.value()).toEqual(fresh);
  });

  it('cancels an in-flight response when the current block is retried', async () => {
    service.blockNum.set(100);
    TestBed.tick();
    const old = http.expectOne(url);
    service.reloadCurrentBlock();
    TestBed.tick();
    expect(old.cancelled).toBe(true);
    http.expectOne(url).flush({deltas: []});
    await settle();
    expect(service.deltasResource.value()).toEqual({deltas: []});
  });
});
