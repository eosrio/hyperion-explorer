import { Component, computed, signal, inject, ChangeDetectionStrategy } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ActionDataComponent } from "../action-data/action-data.component";
import { formatChainTime, isoChainTime, TimePreference } from "../../chain-time";
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import {
  MatNestedTreeNode,
  MatTree,
  MatTreeNestedDataSource,
  MatTreeNodeDef,
  MatTreeNodeOutlet,
  MatTreeNodeToggle
} from "@angular/material/tree";
import { NestedTreeControl } from "@angular/cdk/tree";
import { MatIcon } from "@angular/material/icon";
import { MatIconButton } from "@angular/material/button";

interface Authorization {
  actor: string;
  permission: string;
}
interface Receipt {
  receiver: string;
  recv_sequence?: string | number;
}

interface KeyValueNode {
  name: string;
  value?: any;
  arrayItem: boolean;
  children?: KeyValueNode[];
}

@Component({
  selector: "app-action-details",
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
    MatTreeNodeDef,
    RouterLink,
    ActionDataComponent
  ],
  templateUrl: "./action-details.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./action-details.component.css"
})
export class ActionDetailsComponent {
  dialogRef = inject<MatDialogRef<ActionDetailsComponent>>(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);

  private readonly timePreference = inject(TimePreference);
  action = signal<any>(null);

  readonly time = computed(() => {
    const action = this.action();
    const value = action?.["@timestamp"] ?? action?.timestamp;
    if (!value) return null;
    return { text: formatChainTime(value, this.timePreference.utc()), iso: isoChainTime(value) };
  });
  readonly authorizations = computed<Authorization[]>(() => {
    const list = this.action()?.act?.authorization;
    return Array.isArray(list) ? list.filter(auth => typeof auth?.actor === "string" && typeof auth?.permission === "string") : [];
  });
  readonly receipts = computed<Receipt[]>(() => {
    const list = this.action()?.receipts;
    return Array.isArray(list) ? list.filter(receipt => typeof receipt?.receiver === "string") : [];
  });

  actionTreeControl = new NestedTreeControl<KeyValueNode>(dataNode => dataNode.children);
  actionTree = new MatTreeNestedDataSource<KeyValueNode>();

  constructor() {
    if (this.data.action) {
      this.action.set(this.data.action);

      this.buildTreeData();
    }
  }

  exit(): void {
    this.dialogRef.close();
  }

  hasChild = (_: number, node: KeyValueNode) => !!node.children && node.children.length > 0;

  /** "All fields" opens at the bottom of the dialog; bring its first rows into view. */
  revealAllFields(event: Event): void {
    const details = event.target as HTMLDetailsElement;
    if (!details.open) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    details.scrollIntoView({ behavior: motion, block: "start" });
  }

  private buildTreeData() {
    const treeData: KeyValueNode[] | undefined = this.objectToTree(this.action());
    if (treeData) {
      this.actionTree.data = treeData;
    }
  }

  private objectToTree(root: any): KeyValueNode[] {
    const children: KeyValueNode[] = [];
    for (let rootKey in root) {
      if (rootKey === "@timestamp") continue;

      if (!root.hasOwnProperty(rootKey)) continue;

      const value = root[rootKey];
      const arrayItem = Array.isArray(root);
      if (typeof value === "object") {
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
