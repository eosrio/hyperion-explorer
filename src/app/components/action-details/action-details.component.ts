import {Component, Inject, signal} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from "@angular/material/dialog";
import {
  MatNestedTreeNode,
  MatTree,
  MatTreeNestedDataSource, MatTreeNodeDef,
  MatTreeNodeOutlet,
  MatTreeNodeToggle
} from "@angular/material/tree";
import {NestedTreeControl} from "@angular/cdk/tree";
import {MatIcon} from "@angular/material/icon";
import {MatIconButton} from "@angular/material/button";

interface KeyValueNode {
  name: string;
  value?: any;
  arrayItem: boolean;
  children?: KeyValueNode[];
}

@Component({
  selector: 'app-action-details',
  imports: [
    MatTree,
    MatTreeNodeToggle,
    MatNestedTreeNode,
    MatIcon,
    MatIconButton,
    MatTreeNodeOutlet,
    MatDialogTitle,
    MatDialogContent,
    MatDialogClose,
    MatTreeNodeDef
  ],
  templateUrl: './action-details.component.html',
  styleUrl: './action-details.component.css'
})
export class ActionDetailsComponent {

  action = signal<any>(null);

  actionTreeControl = new NestedTreeControl<KeyValueNode>(dataNode => dataNode.children);
  actionTree = new MatTreeNestedDataSource<KeyValueNode>();

  constructor(
    public dialogRef: MatDialogRef<ActionDetailsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    console.log(this.data);
    if (this.data.action) {
      this.action.set(this.data.action);

      this.buildTreeData();

    }
  }

  exit(): void {
    this.dialogRef.close();
  }

  hasChild = (_: number, node: KeyValueNode) => !!node.children && node.children.length > 0;

  private buildTreeData() {
    const treeData: KeyValueNode[] | undefined = this.objectToTree(this.action());
    console.log(treeData);
    if (treeData) {
      this.actionTree.data = treeData;
    }
  }

  private objectToTree(root: any): KeyValueNode[] {
    const children: KeyValueNode[] = [];
    for (let rootKey in root) {

      if (rootKey === '@timestamp') continue;

      if (!root.hasOwnProperty(rootKey)) continue;

      const value = root[rootKey];
      const arrayItem = Array.isArray(root);
      if (typeof value === 'object') {
        children.push({
          name: rootKey,
          arrayItem,
          children: this.objectToTree(value)
        });
      } else {
        children.push({
          name: rootKey,
          arrayItem,
          value: value
        });
      }
    }
    return children;
  }
}
