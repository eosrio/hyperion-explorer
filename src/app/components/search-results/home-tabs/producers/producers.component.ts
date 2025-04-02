import { Component } from '@angular/core';
import {MatSort} from "@angular/material/sort";
import {MatCell, MatCellDef, MatColumnDef, MatHeaderCell, MatTable} from "@angular/material/table";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {MatRipple} from "@angular/material/core";
import {MatTooltip} from "@angular/material/tooltip";

@Component({
  selector: 'app-producers',
  imports: [
    MatSort,
    MatTable,
    FaIconComponent,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatRipple,
    MatTooltip
  ],
  templateUrl: './producers.component.html',
  styleUrl: './producers.component.css'
})
export class ProducersComponent {

}
