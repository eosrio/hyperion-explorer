import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvmBlockComponent } from './evm-block.component';

describe('EvmBlockComponent', () => {
  let component: EvmBlockComponent;
  let fixture: ComponentFixture<EvmBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvmBlockComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EvmBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
