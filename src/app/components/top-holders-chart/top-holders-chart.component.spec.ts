import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopHoldersChartComponent } from './top-holders-chart.component';

describe('TopHoldersChartComponent', () => {
  let component: TopHoldersChartComponent;
  let fixture: ComponentFixture<TopHoldersChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopHoldersChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopHoldersChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
