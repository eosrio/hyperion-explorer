import {Component, Inject, signal} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogContent, MatDialogTitle} from "@angular/material/dialog";
import {ContractExplorerData} from "../../interfaces";
import {ContractExplorerComponent} from "../contract-explorer/contract-explorer.component";
import {NgOptimizedImage} from "@angular/common";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {faUserCircle} from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: 'app-contract-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    ContractExplorerComponent,
    NgOptimizedImage,
    FaIconComponent
  ],
  templateUrl: './contract-dialog.component.html',
  standalone: true,
  styleUrl: './contract-dialog.component.css'
})
export class ContractDialogComponent {

  code = signal<string | null>(null);
  table = signal<string | null>(null);
  scope = signal<string | null>(null);

  icons = {
    solid: {
      faUserCircle: faUserCircle
    }
  }

  constructor(@Inject(MAT_DIALOG_DATA) public data: ContractExplorerData) {
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
