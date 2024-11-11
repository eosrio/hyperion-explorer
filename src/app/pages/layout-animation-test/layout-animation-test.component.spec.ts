import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutAnimationTestComponent } from './layout-animation-test.component';

describe('LayoutAnimationTestComponent', () => {
  let component: LayoutAnimationTestComponent;
  let fixture: ComponentFixture<LayoutAnimationTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutAnimationTestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayoutAnimationTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
