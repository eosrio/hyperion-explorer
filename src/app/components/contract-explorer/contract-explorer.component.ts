import {afterNextRender, Component, computed, input, signal, ViewChild} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from "@angular/router";
import {toSignal} from "@angular/core/rxjs-interop";
import {HttpClient} from "@angular/common/http";
import {lastValueFrom} from "rxjs";
import {environment} from "../../../env";
import {MatButton} from "@angular/material/button";
import {KeyValuePipe} from "@angular/common";
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable
} from "@angular/material/table";
import {MatSort, MatSortHeader, Sort} from "@angular/material/sort";

interface AbiTable {
  index_type: string;
  key_names: any[];
  key_types: any[];
  name: string;
  type: string;
}

interface AbiStructField {
  name: string;
  type: string;
}

@Component({
  selector: 'app-contract-explorer',
  standalone: true,
  imports: [
    MatButton,
    KeyValuePipe,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCellDef,
    MatCell,
    MatHeaderRow,
    MatRow,
    MatRowDef,
    MatHeaderRowDef,
    MatSortHeader,
    MatSort
  ],
  templateUrl: './contract-explorer.component.html',
  styleUrl: './contract-explorer.component.css'
})
export class ContractExplorerComponent {

  paramMap = toSignal(this.route.paramMap);

  code = signal("");
  codeInput = input<string>("");
  table = computed(() => this.paramMap()?.get("table") ?? "");
  scope = computed(() => this.paramMap()?.get("scope") ?? "");

  abi: any | null = null;
  tables = signal<AbiTable[]>([]);
  tableNames = computed<string[]>(() => {
    return this.tables().map((table: AbiTable) => table.name);
  });
  selectedTable = signal<string>("");

  scopes = signal<any[]>([]);
  scopeNames = computed<string[]>(() => {
    return [this.code(), ...this.scopes().map((row: any) => row.scope)];
  });
  selectedScope = signal<string>("");

  tableRows = signal<any[]>([]);
  sortBy = signal<string>("");
  sortDirection = signal<string>("desc");

  tableData = computed(() => {
    if (this.sortDirection() === '') {
      return this.tableRows();
    } else {
      return [...this.tableRows()].sort((a: any, b: any) => {
        if (this.sortDirection() === 'desc') {
          return a[this.sortBy()] > b[this.sortBy()] ? 1 : -1;
        } else {
          return a[this.sortBy()] > b[this.sortBy()] ? -1 : 1;
        }
      });
    }
  });

  fields = signal<AbiStructField[]>([]);
  displayedColumns = computed<string[]>(() => {
    return this.fields().map(value => value.name);
  });

  @ViewChild(MatSort) sort?: MatSort;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {

    afterNextRender(() => {
      this.route.paramMap.subscribe(value => {
        console.log(value);
        this.processRouteParams(value).catch(console.error);
      });
    });
  }

  async processRouteParams(params: ParamMap) {
    const pCode = this.codeInput() !== "" ? this.codeInput() : (params.get('code') ?? "");
    const pTable = params.get('table') ?? "";
    const pScope = params.get('scope') ?? "";
    console.log(pCode, pTable, pScope);
    if (pCode && pTable && pScope) {
      this.code.set(pCode);
      this.selectedTable.set(pTable);
      this.selectedScope.set(pScope);
      await this.getTableRows(pCode, pTable, pScope);
      await this.getAbi(pCode);
      this.loadTableStruct(pTable);
      await this.getTableScopes(pCode, pTable);
    } else {
      if (pCode) {
        this.code.set(pCode);
        await this.getAbi(pCode);
        if (pTable) {
          this.selectedTable.set(pTable);
          this.loadTableStruct(pTable);
          await this.getTableScopes(pCode, pTable);
          if (pScope) {
            this.selectedScope.set(pScope);
            await this.getTableRows(pCode, pTable, pScope);
          }
        }
      }
    }
  }

  async getAbi(code: string) {
    const url = `${environment.hyperionApiUrl}/v1/chain/get_abi?account_name=${code}`;
    const data: any = await lastValueFrom(this.http.get(url));
    if (data && data.abi) {
      this.abi = data.abi;
      if (this.abi.tables && this.abi.tables.length > 0) {
        this.tables.set(this.abi.tables);
        // console.log('Tables:', this.tableNames());
      }
    }
  }

  async getTableScopes(code: string, table: string) {
    const url = `${environment.hyperionApiUrl}/v1/chain/get_table_by_scope?code=${code}&table=${table}`;
    const data: any = await lastValueFrom(this.http.get(url));
    if (data && data.rows) {
      this.scopes.set(data.rows);
      // console.log('Scopes:', this.scopeNames());
    }
    // console.log(data);
  }

  async getTableRows(code: string, table: string, scope: string) {
    const url = `${environment.hyperionApiUrl}/v1/chain/get_table_rows?code=${code}&table=${table}&scope=${scope}`;
    const data: any = await lastValueFrom(this.http.get(url));
    if (data && data.rows) {
      // console.log('Rows:', data.rows);
      this.tableRows.set(data.rows);
    }
  }

  buildFieldArray(array: AbiStructField[], type: string): void {
    if (array && type) {
      const struct = this.abi.structs.find((struct: any) => struct.name === type);
      if (struct.base) {
        // console.log(`Using base: ${struct.base}`);
        this.buildFieldArray(array, struct.base);
      }
      array.push(...struct.fields);
    }
  }

  async selectTable(name: string) {
    this.selectedTable.set(name);
    await this.router.navigate(['contract', this.code(), name]);
  }

  async selectScope(name: string) {
    this.selectedScope.set(name);
    await this.router.navigate(['contract', this.code(), this.table(), name]);
  }

  private loadTableStruct(pTable: string) {
    // get table struct
    const selectedTable = this.tables().find((table: AbiTable) => table.name === pTable);
    if (selectedTable) {
      if (selectedTable.type) {
        const fieldArray: AbiStructField[] = [];
        this.buildFieldArray(fieldArray, selectedTable.type);
        this.fields.set(fieldArray);
      }
    }
  }

  announceSortChange(sortState: Sort) {
    console.log(sortState);
    this.sortBy.set(sortState.active);
    this.sortDirection.set(sortState.direction);
  }
}
