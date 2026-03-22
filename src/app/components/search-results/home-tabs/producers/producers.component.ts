import { Component, inject, viewChild, effect } from '@angular/core';
import { MatSort, MatSortModule } from "@angular/material/sort"; // Import MatSortModule
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatRowDef, MatHeaderRowDef, MatRow, MatTableModule } from "@angular/material/table"; // Import more table modules & MatTableModule
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { MatRipple } from "@angular/material/core";
import { MatTooltip } from "@angular/material/tooltip";
import { ChainService } from "../../../../services/chain.service"; // Import ChainService
import { DecimalPipe } from "@angular/common";
import { RouterModule } from "@angular/router"; // Import RouterModule for links
import { MatProgressSpinner } from "@angular/material/progress-spinner"; // Import MatProgressSpinner
import { countries } from './countries';

@Component({
  selector: 'app-producers',
  imports: [
    DecimalPipe,
    RouterModule,
    MatTableModule,
    MatSortModule,
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
    MatProgressSpinner // Add MatProgressSpinner
    // Removed duplicate imports
  ],
  templateUrl: './producers.component.html',
  styleUrl: './producers.component.css'
})
export class ProducersComponent {
  chainService = inject(ChainService); // Inject ChainService

  // MatTable data source
  dataSource = new MatTableDataSource<any>([]);

  // Define columns to be displayed in the table
  displayedColumns: string[] = ['rank', 'account', 'location', 'total_votes'];

  // Lookup maps for country names by code
  private readonly countryNameByNumeric = new Map<string, string>(
    countries.map(c => [c['country-code'], c.name])
  );
  private readonly countryNameByAlpha3 = new Map<string, string>(
    countries.map(c => [c['alpha-3'].toUpperCase(), c.name])
  );

  // Helper to resolve country name from producer.location which may be numeric (ISO 3166-1) or alpha-3
  countryName = (loc: unknown): string => {
    if (loc === null || loc === undefined) {
      return '-';
    }
    let s = String(loc).trim();
    if (!s) {
      return '-';
    }
    // If numeric, left-pad to 3 digits to match dataset
    if (/^\d+$/.test(s)) {
      s = s.padStart(3, '0');
      return this.countryNameByNumeric.get(s) ?? s;
    }
    // Assume alpha-3 code otherwise
    s = s.toUpperCase();
    return this.countryNameByAlpha3.get(s) ?? s;
  };

  constructor() {
    // React to producers signal and populate the table data
    effect(() => {
      const rows = this.chainService.producers();
      this.dataSource.data = rows.map((p: any, i: number) => ({ ...p, _rank: i + 1 }));
    });
  }

  // Set up sorting
  sort = viewChild(MatSort);

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (row: any, columnId: string): string | number => {
      switch (columnId) {
        case 'rank':
          return row._rank ?? 0;
        case 'account':
          return (row.owner || '').toString().toLowerCase();
        case 'location':
          return this.countryName(row.location) || '';
        case 'total_votes':
          const v = parseFloat(row.total_votes);
          return isNaN(v) ? 0 : v;
        default:
          const value = (row as any)[columnId];
          if (typeof value === 'string') return value.toLowerCase();
          if (typeof value === 'number') return value;
          return value ?? '';
      }
    };
    this.dataSource.sort = this.sort() ?? null;
  }
}
