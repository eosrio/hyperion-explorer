import {Component, computed, input} from '@angular/core';
import {PermissionNodeComponent} from "./permission-node/permission-node.component";
import {Permission} from "../../interfaces";

function getChildren(arr: Permission[], parent: string): Permission[] {
  return arr.filter(value => value.parent === parent).map((value) => {
    const children = getChildren(arr, value.perm_name);
    if (children.length > 0) {
      value.children = children;
    }
    value.expanded = value.perm_name === 'owner';
    return value;
  });
}

@Component({
  selector: 'app-permission-tree',
  imports: [PermissionNodeComponent],
  template: `
    @for (node of treeData(); track node.perm_name) {
      <app-permission-node [expanded]="true" [level]="0" [node]="node"></app-permission-node>
    }
  `
})
export class PermissionTreeComponent {
  permissions = input.required<Permission[]>();
  treeData = computed<Permission[]>(() => {
    return getChildren(this.permissions(), '');
  });
}
