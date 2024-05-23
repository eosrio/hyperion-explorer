import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContractExplorerComponent } from './contract-explorer.component';

describe('ContractExplorerComponent', () => {
  let component: ContractExplorerComponent;
  let fixture: ComponentFixture<ContractExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractExplorerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ContractExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
