import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutTransitionComponent } from './layout-transition.component';

describe('LayoutTransitionComponent', () => {
  let component: LayoutTransitionComponent;
  let fixture: ComponentFixture<LayoutTransitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutTransitionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayoutTransitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
