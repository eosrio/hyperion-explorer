import { TestBed } from '@angular/core/testing';

import { DeltaService } from './delta.service';

describe('DeltaService', () => {
  let service: DeltaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeltaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
