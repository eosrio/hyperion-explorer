import { Component, computed, inject, signal, ChangeDetectionStrategy } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogTitle } from "@angular/material/dialog";
import { ContractExplorerData } from "../../interfaces";
import { ContractExplorerComponent } from "../contract-explorer/contract-explorer.component";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";

@Component({
  selector: "app-contract-dialog",
  imports: [MatDialogTitle, ContractExplorerComponent, MatDialogClose, MatIconButton, MatIcon, RouterLink],
  templateUrl: "./contract-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./contract-dialog.component.css"
})
export class ContractDialogComponent {
  data: ContractExplorerData = inject(MAT_DIALOG_DATA);

  code = signal<string>(this.data.account);
  table = signal<string | null>(null);
  scope = signal<string | null>(null);

  /** The same contract, table and scope as a standalone page that can be bookmarked and shared. */
  readonly pagePath = computed(() => ["/contract", this.code(), this.table(), this.scope()].filter((part): part is string => !!part));

  constructor() {
    if (this.data.account) {
      this.code.set(this.data.account);
    }
    if (this.data.table) {
      this.table.set(this.data.table);
    }
    if (this.data.scope) {
      this.scope.set(this.data.scope);
    }
  }
}
