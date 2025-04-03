import { Component, inject } from '@angular/core'; // Import inject
import { MatSort, MatSortModule } from "@angular/material/sort"; // Import MatSortModule
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatRowDef, MatHeaderRowDef, MatRow, MatTableModule } from "@angular/material/table"; // Import more table modules & MatTableModule
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { MatRipple } from "@angular/material/core";
import { MatTooltip } from "@angular/material/tooltip";
import { ChainService } from "../../../../services/chain.service"; // Import ChainService
import { CommonModule } from "@angular/common"; // Import CommonModule for pipes
import { RouterModule } from "@angular/router"; // Import RouterModule for links
import { MatProgressSpinner } from "@angular/material/progress-spinner"; // Import MatProgressSpinner

@Component({
  selector: 'app-producers',
  standalone: true, // Make standalone
  imports: [
    CommonModule, // Add CommonModule
    RouterModule, // Add RouterModule
    MatTableModule, // Add MatTableModule
    MatSortModule, // Add MatSortModule
    MatSort,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatRowDef,
    MatHeaderRowDef,
    MatRow,
    FaIconComponent, // Keep FaIconComponent if needed later
    MatRipple, // Keep MatRipple if needed later
    MatTooltip,
    MatProgressSpinner // Add MatProgressSpinner
    // Removed duplicate imports
  ],
  templateUrl: './producers.component.html',
  styleUrl: './producers.component.css'
})
export class ProducersComponent {
  chainService = inject(ChainService); // Inject ChainService

  // Define columns to be displayed in the table
  displayedColumns: string[] = ['rank', 'account', 'location', 'totalVotes'];

  // Note: We'll bind the dataSource directly in the template using the signal
}
