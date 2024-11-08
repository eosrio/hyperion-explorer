import {Component, Inject, signal} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogContent, MatDialogTitle} from "@angular/material/dialog";
import {ExploreContractDialogData} from "../../interfaces";
import {ContractExplorerComponent} from "../contract-explorer/contract-explorer.component";

@Component({
  selector: 'app-contract-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    ContractExplorerComponent
  ],
  templateUrl: './contract-dialog.component.html',
  standalone: true,
  styleUrl: './contract-dialog.component.css'
})
export class ContractDialogComponent {

  code = signal<string>("");

  constructor(@Inject(MAT_DIALOG_DATA) public data: ExploreContractDialogData) {
    if(this.data.code) {
      this.code.set(this.data.code);
    }
  }
}
