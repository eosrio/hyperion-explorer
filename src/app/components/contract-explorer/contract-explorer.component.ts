import {Component, computed, signal} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {toObservable, toSignal} from "@angular/core/rxjs-interop";
import {HttpClient} from "@angular/common/http";
import {lastValueFrom} from "rxjs";
import {environment} from "../../../env";
import {MatButton} from "@angular/material/button";
import {KeyValuePipe} from "@angular/common";

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
    KeyValuePipe
  ],
  templateUrl: './contract-explorer.component.html',
  styleUrl: './contract-explorer.component.css'
})
export class ContractExplorerComponent {

  paramMap = toSignal(this.route.paramMap);

  code = signal("");
  code$ = toObservable(this.code);
  table = computed(() => this.paramMap()?.get("table") ?? "");
  table$ = toObservable(this.table);
  scope = computed(() => this.paramMap()?.get("scope") ?? "");
  scope$ = toObservable(this.scope);

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
  fields = signal<AbiStructField[]>([]);

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {

    this.route.paramMap.subscribe(async (params) => {
      const pCode = params.get('code') ?? "";
      const pTable = params.get('table') ?? "";
      const pScope = params.get('scope') ?? "";

      console.log(pCode, pTable, pScope);

      if (pCode) {
        this.code.set(pCode);
        await this.getAbi(pCode);
        if (pTable) {
          this.selectedTable.set(pTable);
          // get table struct
          const selectedTable = this.tables().find((table: AbiTable) => table.name === pTable);
          if (selectedTable) {
            if (selectedTable.type) {
              const fieldArray: AbiStructField[] = [];
              this.buildFieldArray(fieldArray, selectedTable.type);
              this.fields.set(fieldArray);
            }
          }
          await this.getTableScopes(pCode, pTable);
          if (pScope) {
            this.selectedScope.set(pScope);
            await this.getTableRows(pCode, pTable, pScope);
          }
        }
      }

    });

    // // monitor code changes
    // this.code$.subscribe(value => {
    //   console.log(`Code: ${value}`);
    //   if (value) {
    //     this.getAbi(value).catch(console.error);
    //   }
    // });
    //
    // // monitor table changes
    // this.table$.subscribe(value => {
    //   console.log(`Table: ${value}`);
    //   if (value) {
    //
    //     // get table struct
    //     const selectedTable = this.tables().find((table: AbiTable) => table.name === value);
    //     if (selectedTable) {
    //       if (selectedTable.type) {
    //         const fieldArray: AbiStructField[] = [];
    //         this.buildFieldArray(fieldArray, selectedTable.type);
    //         this.fields.set(fieldArray);
    //       }
    //     }
    //
    //     this.getTableScopes(this.code(), value).catch(console.error);
    //   }
    // });
    //
    // // monitor scope changes
    // this.scope$.subscribe(value => {
    //   console.log(`Scope: ${value}`);
    //   if (value) {
    //     this.getTableRows(this.code(), this.table(), this.scope()).catch(console.error);
    //   }
    // });
  }

  async getAbi(code: string) {
    const url = `${environment.hyperionApiUrl}/v1/chain/get_abi?account_name=${code}`;
    const data: any = await lastValueFrom(this.http.get(url));
    if (data && data.abi) {
      this.abi = data.abi;
      if (this.abi.tables && this.abi.tables.length > 0) {
        this.tables.set(this.abi.tables);
        console.log('Tables:', this.tableNames());
      }
    }
  }

  async getTableScopes(code: string, table: string) {
    const url = `${environment.hyperionApiUrl}/v1/chain/get_table_by_scope?code=${code}&table=${table}`;
    const data: any = await lastValueFrom(this.http.get(url));
    if (data && data.rows) {
      this.scopes.set(data.rows);
      console.log('Scopes:', this.scopeNames());
    }
    console.log(data);
  }

  async getTableRows(code: string, table: string, scope: string) {
    const url = `${environment.hyperionApiUrl}/v1/chain/get_table_rows?code=${code}&table=${table}&scope=${scope}`;
    const data: any = await lastValueFrom(this.http.get(url));
    if (data && data.rows) {
      console.log('Rows:', data.rows);
      this.tableRows.set(data.rows);
    }
  }

  buildFieldArray(array: AbiStructField[], type: string): void {
    if (array && type) {
      const struct = this.abi.structs.find((struct: any) => struct.name === type);
      if (struct.base) {
        console.log(`Using base: ${struct.base}`);
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
}
