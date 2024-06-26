import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvmTransactionComponent } from './evm-transaction.component';

describe('EvmTransactionComponent', () => {
  let component: EvmTransactionComponent;
  let fixture: ComponentFixture<EvmTransactionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvmTransactionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EvmTransactionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
