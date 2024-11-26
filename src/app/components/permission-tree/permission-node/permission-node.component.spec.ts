import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionNodeComponent } from './permission-node.component';

describe('PermissionNodeComponent', () => {
  let component: PermissionNodeComponent;
  let fixture: ComponentFixture<PermissionNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionNodeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionNodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
