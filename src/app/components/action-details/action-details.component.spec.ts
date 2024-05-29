import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActionDetailsComponent } from './action-details.component';

describe('ActionDetailsComponent', () => {
  let component: ActionDetailsComponent;
  let fixture: ComponentFixture<ActionDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionDetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ActionDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
