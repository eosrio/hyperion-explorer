import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActDataViewComponent } from './act-data-view.component';

describe('ActDataViewComponent', () => {
  let component: ActDataViewComponent;
  let fixture: ComponentFixture<ActDataViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActDataViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActDataViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
