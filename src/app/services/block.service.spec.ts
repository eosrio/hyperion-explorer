import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { BlockService } from './block.service';
import { DataService } from './data.service';

describe('BlockService history availability', () => {
  let service: BlockService;
  let http: HttpTestingController;
  const origin = 'https://chain.example';
  const id = '00000064' + 'a'.repeat(56);
  const header = {id, block_num: 100, previous: '00000063' + 'b'.repeat(56),
    producer: 'producer', timestamp: '2026-11-04T14:44:00.000', transactions: [{id: 'c'.repeat(64)}]};
  const trace = {id, number: 100, transactions: [{id: 'c'.repeat(64), actions: []}]};

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.inject(DataService).setOrigin(origin);
    service = TestBed.inject(BlockService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ignoreCancelled: true}));
  async function settle() {
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.tick();
  }
  function lookup(byId = false) {
    if (byId) service.blockId.set(id); else service.blockNum.set(100);
    TestBed.tick();
    return http.expectOne(origin + '/v1/trace_api/get_block');
  }

  it('preserves actual history results without a chain fallback', async () => {
    lookup().flush(trace);
    await settle();
    expect(service.blockResource.value()).toEqual(trace);
    http.expectNone(origin + '/v1/chain/get_block');
  });

  it.each([404, 500, 502, 503, 504])('shows only a validated header when history returns %s', async status => {
    lookup().flush({message: 'Unavailable'}, {status, statusText: 'Unavailable'});
    await settle();
    const request = http.expectOne(origin + '/v1/chain/get_block');
    expect(request.request.body).toEqual({block_num_or_id: 100});
    request.flush(header);
    await settle();
    expect(service.blockResource.value()).toEqual({id, number: 100, previous_id: header.previous,
      producer: header.producer, timestamp: header.timestamp, transactions: [], historyUnavailable: true});
  });

  it('validates an ID lookup and replaces the header with history after retry', async () => {
    lookup(true).flush({}, {status: 503, statusText: 'Unavailable'});
    await settle();
    const request = http.expectOne(origin + '/v1/chain/get_block');
    expect(request.request.body).toEqual({block_num_or_id: id});
    request.flush(header);
    await settle();
    expect(service.blockResource.value().historyUnavailable).toBe(true);
    service.blockResource.reload();
    TestBed.tick();
    http.expectOne(origin + '/v1/trace_api/get_block').flush(trace);
    await settle();
    expect(service.blockResource.value()).toEqual(trace);
  });

  it.each([400, 401, 403, 429])('preserves history error %s without an extra request', async status => {
    lookup().flush({}, {status, statusText: 'Refused'});
    await settle();
    expect(service.blockResource.error()).toMatchObject({status});
    http.expectNone(origin + '/v1/chain/get_block');
  });

  it.each([
    {...header, block_num: 101},
    {...header, id: '00000065' + 'a'.repeat(56)},
    {...header, id: 'invalid'},
    {...header, previous: 'invalid'},
    {...header, previous: '00000001' + 'b'.repeat(56)},
    {...header, timestamp: 'invalid'},
    {...header, timestamp: '2026-02-30T14:44:00.000'},
    {...header, timestamp: '2026-11-04T24:00:00.000'}
  ])('refuses an inconsistent or malformed chain header', async invalid => {
    lookup().flush({}, {status: 503, statusText: 'Unavailable'});
    await settle();
    http.expectOne(origin + '/v1/chain/get_block').flush(invalid);
    await settle();
    expect(service.blockResource.error()).toMatchObject({status: 503});
    expect(service.blockResource.hasValue()).toBe(false);
  });

  it('refuses a different ID even at the requested height', async () => {
    lookup(true).flush({}, {status: 503, statusText: 'Unavailable'});
    await settle();
    http.expectOne(origin + '/v1/chain/get_block').flush({...header, id: '00000064' + 'd'.repeat(56)});
    await settle();
    expect(service.blockResource.error()).toMatchObject({status: 503});
  });

  it('preserves the history error when chain lookup also fails', async () => {
    lookup().flush({}, {status: 503, statusText: 'Unavailable'});
    await settle();
    http.expectOne(origin + '/v1/chain/get_block').flush({}, {status: 404, statusText: 'Missing'});
    await settle();
    expect(service.blockResource.error()).toMatchObject({status: 503});
  });

  it('cancels an obsolete header request when the block changes', async () => {
    lookup().flush({}, {status: 503, statusText: 'Unavailable'});
    await settle();
    const old = http.expectOne(origin + '/v1/chain/get_block');
    service.blockNum.set(101);
    TestBed.tick();
    expect(old.cancelled).toBe(true);
    http.expectOne(origin + '/v1/trace_api/get_block').flush({...trace, number: 101});
    await settle();
    expect(service.blockResource.value().number).toBe(101);
    expect(service.blockResource.value().historyUnavailable).toBeUndefined();
  });
});
