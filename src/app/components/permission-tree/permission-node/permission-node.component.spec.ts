import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PermissionNodeComponent } from "./permission-node.component";

describe("PermissionNodeComponent", () => {
  let component: PermissionNodeComponent;
  let fixture: ComponentFixture<PermissionNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionNodeComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionNodeComponent);
    fixture.componentRef.setInput("node", { perm_name: "owner", parent: "", required_auth: { threshold: 1, keys: [] } });
    fixture.componentRef.setInput("level", 0);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
