import { Component, computed, input, ChangeDetectionStrategy } from "@angular/core";
import { PermissionNodeComponent } from "./permission-node/permission-node.component";
import { Permission } from "../../interfaces";
import { permissionRows } from "./permission-rows";

/** The account's permissions as one aligned list: depth indents the name, every signer lines up beside it. */
@Component({
  selector: "app-permission-tree",
  imports: [PermissionNodeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="permission-list" role="list">
      @for (row of rows(); track row.permission.perm_name) {
        <app-permission-node role="listitem" [level]="row.depth" [node]="row.permission"></app-permission-node>
      }
    </div>
  `
})
export class PermissionTreeComponent {
  permissions = input.required<Permission[]>();
  rows = computed(() => permissionRows(this.permissions() ?? []));
}
