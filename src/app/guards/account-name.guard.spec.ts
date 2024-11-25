import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { accountNameGuard } from './account-name.guard';

describe('accountNameGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => accountNameGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
