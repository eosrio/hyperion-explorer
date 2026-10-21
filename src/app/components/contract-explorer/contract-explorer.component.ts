import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  PLATFORM_ID,
  signal,
  ChangeDetectionStrategy
} from "@angular/core";
import { Router } from "@angular/router";
import { rxResource } from "@angular/core/rxjs-interop";
import { HttpClient } from "@angular/common/http";
import { lastValueFrom, map, of } from "rxjs";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatCell, MatColumnDef, MatHeaderCell, MatHeaderRow, MatRow, MatTableModule } from "@angular/material/table";
import { MatSort, MatSortHeader, Sort } from "@angular/material/sort";
import { MatTooltip } from "@angular/material/tooltip";
import { AbiStructField, AbiTable, GetAbiResponse } from "../../interfaces";
import { FormsModule } from "@angular/forms";
import { MatDialogContent } from "@angular/material/dialog";
import { isPlatformBrowser, NgClass } from "@angular/common";
import { MatIcon } from "@angular/material/icon";
import { ActDataViewComponent } from "../act-data-view/act-data-view.component";
import { DataService } from "../../services/data.service";
import { describeApiError } from "../../api-errors";

function buildFieldArray(structs: any[], array: AbiStructField[], type: string): void {
  if (array && type) {
    const struct = structs.find((struct: any) => struct.name === type);
    if (!struct) return;
    if (struct.base) {
      buildFieldArray(structs, array, struct.base);
    }
    array.push(...struct.fields);
  }
}

@Component({
  selector: "app-contract-explorer",
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
    MatIconButton,
    MatIcon,
    ActDataViewComponent
  ],
  templateUrl: "./contract-explorer.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./contract-explorer.component.css"
})
export class ContractExplorerComponent {
  readonly describeApiError = describeApiError;
  http = inject(HttpClient);
  router = inject(Router);
  data = inject(DataService);

  code = model<string | null | undefined>(null);
  table = model<string | null | undefined>(null);
  scope = model<string | null | undefined>(null);

  scopeLb = signal<string>("");

  navMode = input<string>("");

  // request endpoints
  endpoints = {
    getAbi: `${this.data.env.hyperionApiUrl}/v1/chain/get_abi`,
    getTableByScope: `${this.data.env.hyperionApiUrl}/v1/chain/get_table_by_scope`,
    getTableRows: `${this.data.env.hyperionApiUrl}/v1/chain/get_table_rows`
  };

  getTableByScopeLimit = signal(30);
  private platformId = inject(PLATFORM_ID);

  // request new abi when the code signal changes
  abiRes = rxResource({
    params: () => this.code(),
    stream: ({ params: code }) => {
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
  tableScopesRes = rxResource<
    {
      rows: any[];
      more: string;
    } | null,
    {
      table: string | null | undefined;
      code: string | null | undefined;
      limit: number;
      lb: string;
    }
  >({
    params: () => {
      return {
        table: this.table(),
        code: this.code(),
        limit: this.getTableByScopeLimit() ?? 30,
        lb: this.scopeLb()
      };
    },
    stream: ({ params: data }) => {
      if (data.table) {
        // request table scopes
        return this.http.post<any>(this.endpoints.getTableByScope, {
          code: data.code,
          table: data.table,
          limit: data.limit,
          lower_bound: data.lb,
          json: true
        });
      } else {
        // return empty array if no table is selected
        return of(null);
      }
    }
  });

  tableRowRes = rxResource({
    params: () => ({ code: this.code(), table: this.table(), scope: this.scope(), limit: this.getTableByScopeLimit() }),
    stream: ({ params }) =>
      params.code && params.table && params.scope
        ? this.http.post<{ rows: any[] }>(this.endpoints.getTableRows, { ...params, json: true }).pipe(map(data => data.rows))
        : of([])
  });
  abiTableNames = computed<string[]>(() =>
    this.abiRes.hasValue() ? (this.abiRes.value()?.abi?.tables.map(table => table.name) ?? []) : []
  );
  scopeList = computed<string[]>(() =>
    this.tableScopesRes.hasValue() ? (this.tableScopesRes.value()?.rows.map(row => row.scope) ?? []) : []
  );
  nextScope = computed(() => (this.tableScopesRes.hasValue() ? this.tableScopesRes.value()?.more || "" : ""));
  nextScopePresent = computed(() => !!this.nextScope());
  private scopeHistory = signal<string[]>([]);
  lastScope = computed(() => this.scopeHistory().length > 0);

  setScopeLimit(value: number): void {
    this.getTableByScopeLimit.set(Math.max(1, Math.min(1000, Math.floor(value) || 30)));
    this.scopeLb.set("");
    this.scopeHistory.set([]);
  }

  sortBy = signal<string>("");
  sortDirection = signal<string>("desc");

  // View mode for table data: 'table', 'card', 'expanded'
  // Default to 'expanded' (collapsible list view)
  viewMode = signal<string>("expanded");

  // Track expanded items in expanded view
  expandedItems = signal<Set<number>>(new Set<number>());
  // Internal flag to ensure auto-expand runs only once per table/scope/view session
  autoExpanded = signal<boolean>(false);

  // Toggle expanded state of an item
  toggleItemExpanded(index: number) {
    const currentExpanded = this.expandedItems();
    const newExpanded = new Set(currentExpanded);

    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }

    this.expandedItems.set(newExpanded);
  }

  // Check if an item is expanded
  isItemExpanded(index: number): boolean {
    return this.expandedItems().has(index);
  }

  tableData = linkedSignal<any, any[]>({
    source: () => {
      return {
        rows: this.tableRowRes.hasValue() ? this.tableRowRes.value() : undefined,
        sort: this.sortBy(),
        dir: this.sortDirection()
      };
    },
    computation: (source, previous): any[] => {
      if (source.rows && source.rows.length > 0) {
        if (!source.sort || source.dir === "") {
          return source.rows;
        } else {
          return [...source.rows].sort((a: any, b: any) => {
            const left = a[source.sort];
            const right = b[source.sort];
            const integers = /^\d+$/.test(String(left)) && /^\d+$/.test(String(right));
            const l = integers ? BigInt(left) : left;
            const r = integers ? BigInt(right) : right;
            const comparison = l === r ? 0 : l > r ? 1 : -1;
            return source.dir === "desc" ? -comparison : comparison;
          });
        }
      } else {
        return [];
      }
    }
  });

  fields = computed<AbiStructField[]>(() => {
    const abi = this.abiRes.hasValue() ? this.abiRes.value()?.abi : undefined;
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
    this.scope.set(null);
    this.scopeLb.set("");
    this.scopeHistory.set([]);
    this.tableData.set([]);
    this.expandedItems.set(new Set<number>());
    this.autoExpanded.set(false);
    this.table.set(name);
    if (this.navMode() === "dialog") {
      // append scope as a query parameter
      await this.router.navigate([], { queryParams: { table: name } });
      this.scrollElementIntoView("scope-section");
      // this.scrollToBottom();
    } else {
      await this.router.navigate(["contract", this.code(), name]);
    }
  }

  async selectScope(name: string) {
    this.scope.set(name);
    this.expandedItems.set(new Set<number>());
    this.autoExpanded.set(false);
    if (this.navMode() === "dialog") {
      // append scope as a query parameter
      await this.router.navigate([], { queryParams: { table: this.table(), scope: name } });
      this.scrollElementIntoView("data-section");
    } else {
      await this.router.navigate(["contract", this.code(), this.table(), name]);
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
        element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      }, 100);
    }
  }

  useNextScope(): void {
    if (!this.nextScope()) return;
    this.scopeHistory.update(values => [...values, this.scopeLb()]);
    this.scopeLb.set(this.nextScope());
  }

  constructor() {
    // Auto-expand the first item when entering expanded (list) view with data loaded
    effect(() => {
      const mode = this.viewMode();
      const rows = this.tableData();
      const expanded = this.expandedItems();
      const alreadyAuto = this.autoExpanded();
      if (mode === "expanded" && rows && rows.length > 0 && expanded.size === 0 && !alreadyAuto) {
        this.expandedItems.set(new Set<number>([0]));
        this.autoExpanded.set(true);
      }
    });
  }

  usePreviousScope(): void {
    const history = this.scopeHistory();
    if (!history.length) return;
    this.scopeLb.set(history.at(-1) || "");
    this.scopeHistory.set(history.slice(0, -1));
  }

  // Method to change the view mode
  setViewMode(mode: string) {
    this.viewMode.set(mode);
    // Reset expanded items when changing view mode
    this.expandedItems.set(new Set<number>());
    this.autoExpanded.set(false);
  }
}
