import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeTabsComponent } from './home-tabs.component';

describe('HomeTabsComponent', () => {
  let component: HomeTabsComponent;
  let fixture: ComponentFixture<HomeTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeTabsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
