import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvmAddressComponent } from './evm-address.component';

describe('EvmAddressComponent', () => {
  let component: EvmAddressComponent;
  let fixture: ComponentFixture<EvmAddressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvmAddressComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EvmAddressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
