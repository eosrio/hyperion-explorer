import {Component, computed, effect, inject, input, linkedSignal, model, PLATFORM_ID, signal} from '@angular/core';
import {Router} from "@angular/router";
import {rxResource} from "@angular/core/rxjs-interop";
import {HttpClient} from "@angular/common/http";
import {map, of} from "rxjs";
import {MatButton, MatIconButton} from "@angular/material/button";
import {MatCell, MatColumnDef, MatHeaderCell, MatHeaderRow, MatRow, MatTableModule} from "@angular/material/table";
import {MatSort, MatSortHeader, Sort} from "@angular/material/sort";
import {MatTooltip} from "@angular/material/tooltip";
import {AbiStructField, AbiTable, GetAbiResponse} from "../../interfaces";
import {FormsModule} from '@angular/forms';
import {MatDialogContent} from "@angular/material/dialog";
import {isPlatformBrowser, NgClass} from "@angular/common";
import {MatInput} from "@angular/material/input";
import {MatIcon} from "@angular/material/icon";
import {ActDataViewComponent} from "../act-data-view/act-data-view.component";
import {DataService} from "../../services/data.service";

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
    MatDialogContent,
    NgClass,
    MatInput,
    MatIconButton,
    MatIcon,
    ActDataViewComponent,
  ],
  templateUrl: './contract-explorer.component.html',
  styleUrl: './contract-explorer.component.css'
})
export class ContractExplorerComponent {

  http = inject(HttpClient);
  router = inject(Router);
  data = inject(DataService);

  code = model<string | null | undefined>(null);
  table = model<string | null | undefined>(null);
  scope = model<string | null | undefined>(null);

  navMode = input<string>("");

  // request endpoints
  endpoints = {
    getAbi: `${this.data.env.hyperionApiUrl}/v1/chain/get_abi`,
    getTableByScope: `${this.data.env.hyperionApiUrl}/v1/chain/get_table_by_scope`,
    getTableRows: `${this.data.env.hyperionApiUrl}/v1/chain/get_table_rows`
  };

  getTableByScopeLimit = 20;
  private platformId = inject(PLATFORM_ID);

  // request new abi when the code signal changes
  abiRes = rxResource({
    request: () => this.code(),
    loader: ({request: code}) => {
      if (code) {
        return this.http.post<GetAbiResponse>(this.endpoints.getAbi, {
          account_name: code,
          json: true
        });
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
        return this.http.post<any>(this.endpoints.getTableByScope, {
          code: this.code(),
          table: this.table(),
          limit: this.getTableByScopeLimit,
          json: true
        });
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
        return this.http.post<any>(this.endpoints.getTableRows, {
          code: this.code(),
          table: this.table(),
          scope: scope,
          limit: this.getTableByScopeLimit,
          json: true
        }).pipe(map(d => d.rows));
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

  scopeList = linkedSignal<any, string[]>({
    source: () => this.tableScopesRes.value(),
    computation: (source, previous): string[] => {
      if (source) {
        const scopeSet = new Set<string>();
        // include contract name in the list if the list of scopes is too large
        if (source.more) {
          const contract = this.code();
          if (contract) {
            scopeSet.add(contract);
          }
        }
        if (source.rows) {
          source.rows.forEach((row: any) => scopeSet.add(row.scope));
          return Array.from(scopeSet);
        } else {
          return [];
        }
      } else {
        return previous ? previous.value : [];
      }
    }
  });


  nextScope = linkedSignal<any, string>({
    source: () => this.tableScopesRes.value(),
    computation: (source, previous): string => {
      if (source) {
        return source.more;
      } else {
        return previous ? previous.value : "";
      }
    }
  });

  sortBy = signal<string>("");
  sortDirection = signal<string>("desc");

  tableData = linkedSignal<any, any[]>({
    source: () => {
      return {
        rows: this.tableRowRes.value(),
        sort: this.sortBy(),
        dir: this.sortDirection()
      };
    },
    computation: (source, previous): any[] => {
      if (source.rows && source.rows.length > 0) {
        if (source.dir === '') {
          return source.rows;
        } else {
          return [...source.rows].sort((a: any, b: any) => {
            if (source.dir === 'desc') {
              return a[source.sort] > b[source.sort] ? 1 : -1;
            } else {
              return a[source.sort] > b[source.sort] ? -1 : 1;
            }
          });
        }
      } else {
        return previous ? previous.value : [];
      }
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
    this.scope.set(null);
    this.tableData.set([]);
    if (this.navMode() === 'dialog') {
      // append scope as a query parameter
      await this.router.navigate([], {queryParams: {table: name}});
      this.scrollElementIntoView('scope-section');
      // this.scrollToBottom();
    } else {
      await this.router.navigate(['contract', this.code(), name]);
    }
  }

  async selectScope(name: string) {
    this.scope.set(name);
    if (this.navMode() === 'dialog') {
      // append scope as a query parameter
      await this.router.navigate([], {queryParams: {table: this.table(), scope: name}});
      this.scrollElementIntoView('data-section');
    } else {
      await this.router.navigate(['contract', this.code(), this.table(), name]);
    }
  }

  announceSortChange(sortState: Sort) {
    this.sortBy.set(sortState.active);
    this.sortDirection.set(sortState.direction);
  }

  reloadTables() {
    this.abiRes.reload();
  }

  reloadScopes() {
    this.tableScopesRes.reload();
  }

  reloadRows() {
    this.tableRowRes.reload();
  }

  scrollElementIntoView(id: string) {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const element = document.getElementById(id);
        if (!element) {
          return;
        }
        element.scrollIntoView({behavior: "smooth", block: "start", inline: "nearest"});
      }, 100);
    }
  }
}
