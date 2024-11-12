import {Component, computed, effect, inject, input, model, signal} from '@angular/core';
import {Router} from "@angular/router";
import {rxResource} from "@angular/core/rxjs-interop";
import {HttpClient} from "@angular/common/http";
import {map, of} from "rxjs";
import {environment} from "../../../env";
import {MatButton} from "@angular/material/button";
import {MatCell, MatColumnDef, MatHeaderCell, MatHeaderRow, MatRow, MatTableModule} from "@angular/material/table";
import {MatSort, MatSortHeader, Sort} from "@angular/material/sort";
import {MatTooltip} from "@angular/material/tooltip";
import {AbiStructField, AbiTable, GetAbiResponse} from "../../interfaces";
import {FormsModule} from '@angular/forms';
import {MatDialogContent, MatDialogTitle} from "@angular/material/dialog";

function buildFieldArray(structs: any[], array: AbiStructField[], type: string): void {
  if (array && type) {
    const struct = structs.find((struct: any) => struct.name === type);
    if (struct.base) {
      buildFieldArray(structs, array, struct.base);
    }
    array.push(...struct.fields);
  }
}

@Component({
  selector: 'app-contract-explorer',
  imports: [
    FormsModule,
    MatButton,
    MatTableModule,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    MatHeaderRow,
    MatRow,
    MatSortHeader,
    MatSort,
    MatTooltip,
    MatDialogTitle,
    MatDialogContent
  ],
  templateUrl: './contract-explorer.component.html',
  styleUrl: './contract-explorer.component.css'
})
export class ContractExplorerComponent {

  http = inject(HttpClient);
  router = inject(Router);

  code = model<string | null | undefined>(null);
  table = model<string | null | undefined>(null);
  scope = model<string | null | undefined>(null);

  navMode = input<string>("");

  // request endpoints
  endpoints = {
    getAbi: `${environment.hyperionApiUrl}/v1/chain/get_abi`,
    getTableByScope: `${environment.hyperionApiUrl}/v1/chain/get_table_by_scope`,
    getTableRows: `${environment.hyperionApiUrl}/v1/chain/get_table_rows`
  };

  getTableByScopeLimit = 20;

  constructor() {

    effect(() => {
      console.log('code', this.code());
    });

    effect(() => {
      console.log('table', this.table());
    });

    effect(() => {
      console.log('scope', this.scope());
    });
  }

  // request new abi when the code signal changes
  abiRes = rxResource({
    request: () => this.code(),
    loader: ({request: code}) => {
      if (code) {
        return this.http.get<GetAbiResponse>(this.endpoints.getAbi + '?account_name=' + code);
      } else {
        return of(null);
      }
    }
  });

  // request new table scopes when the table signal changes
  tableScopesRes = rxResource({
    request: () => this.table(),
    loader: ({request: table}) => {
      if (table) {
        // request table scopes
        const reqParams = `?code=${this.code()}&table=${table}&limit=${this.getTableByScopeLimit}`;
        return this.http.get<any>(this.endpoints.getTableByScope + reqParams);
      } else {
        // return empty array if no table is selected
        return of([]);
      }
    }
  });

  tableRowRes = rxResource({
    request: () => this.scope(),
    loader: ({request: scope}) => {
      if (scope) {
        // request table scopes
        const reqParams = `?code=${this.code()}&table=${this.table()}&scope=${scope}`;
        return this.http.get<any>(this.endpoints.getTableRows + reqParams).pipe(map(d => d.rows));
      } else {
        // return empty array if no table is selected
        return of([]);
      }
    }
  });


  abiTableNames = computed<string[]>(() => {
    const data = this.abiRes.value();
    if (data && data.abi) {
      return data.abi.tables.map((table: AbiTable) => table.name);
    } else {
      return [];
    }
  });

  scopeList = computed<string[]>(() => {
    const data = this.tableScopesRes.value();
    const scopeSet = new Set<string>();
    if (data) {
      // include contract name in the list if the list of scopes is too large
      if (data.more) {
        const contract = this.code();
        if (contract) {
          scopeSet.add(contract);
        }
      }
      data.rows.forEach((row: any) => scopeSet.add(row.scope));
      return Array.from(scopeSet);
    } else {
      return [];
    }
  });


  nextScope = computed<string>(() => this.tableScopesRes.value()?.more ?? "");

  sortBy = signal<string>("");
  sortDirection = signal<string>("desc");

  tableData = computed<any[]>(() => {
    const rows = this.tableRowRes.value();
    const sort = this.sortBy();
    const dir = this.sortDirection();
    if (rows && rows.length > 0) {
      if (dir === '') {
        return rows;
      } else {
        return [...rows].sort((a: any, b: any) => {
          if (dir === 'desc') {
            return a[sort] > b[sort] ? 1 : -1;
          } else {
            return a[sort] > b[sort] ? -1 : 1;
          }
        });
      }
    } else {
      return [];
    }
  });

  fields = computed<AbiStructField[]>(() => {
    const abi = this.abiRes.value()?.abi;
    const fieldArray: AbiStructField[] = [];
    if (abi) {
      const type = abi.tables.find((t: AbiTable) => t.name === this.table())?.type;
      if (type) {
        buildFieldArray(abi.structs, fieldArray, type);
      }
    }
    return fieldArray;
  });

  displayedColumns = computed<string[]>(() => this.fields().map(v => v.name));

  async selectTable(name: string) {
    this.table.set(name);
    if (this.navMode() === 'dialog') {

      // append scope as a query parameter
      await this.router.navigate([], {
        queryParams: {
          table: name
        }
      });

    } else {
      await this.router.navigate(['contract', this.code(), name]);
    }
  }

  async selectScope(name: string) {
    this.scope.set(name);
    if (this.navMode() === 'dialog') {

      // append scope as a query parameter
      await this.router.navigate([], {
        queryParams: {
          table: this.table(),
          scope: name
        }
      });

    } else {
      await this.router.navigate(['contract', this.code(), this.table(), name]);
    }
  }

  announceSortChange(sortState: Sort) {
    this.sortBy.set(sortState.active);
    this.sortDirection.set(sortState.direction);
  }
}
