import {ComponentFixture, TestBed} from '@angular/core/testing';

import {PermissionTreeComponent} from './permission-tree.component';

describe('PermissionTreeComponent', () => {
  let component: PermissionTreeComponent;
  let fixture: ComponentFixture<PermissionTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [PermissionTreeComponent]}).compileComponents();
    fixture = TestBed.createComponent(PermissionTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
