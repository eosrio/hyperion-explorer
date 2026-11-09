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
  ChangeDetectionStrategy,
  ElementRef,
  afterRenderEffect
} from "@angular/core";
import { Router } from "@angular/router";
import { rxResource } from "@angular/core/rxjs-interop";
import { HttpClient } from "@angular/common/http";
import { lastValueFrom, map, of } from "rxjs";
import { MatCell, MatColumnDef, MatHeaderCell, MatHeaderRow, MatRow, MatTableModule } from "@angular/material/table";
import { MatSort, MatSortHeader, Sort } from "@angular/material/sort";
import { AbiStructField, AbiTable, GetAbiResponse } from "../../interfaces";
import { FormsModule } from "@angular/forms";
import { isPlatformBrowser } from "@angular/common";
import { MatIcon } from "@angular/material/icon";
import { MatOption, MatSelect } from "@angular/material/select";
import { ActDataViewComponent, symbolFromScope } from "../act-data-view/act-data-view.component";
import { DataService } from "../../services/data.service";
import { describeApiError, isRetryableApiError } from "../../api-errors";
import { nameBreaks } from "../../name-breaks";

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
    MatTableModule,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    MatHeaderRow,
    MatRow,
    MatSortHeader,
    MatSort,
    MatIcon,
    MatSelect,
    MatOption,
    ActDataViewComponent
  ],
  templateUrl: "./contract-explorer.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./contract-explorer.component.css"
})
export class ContractExplorerComponent {
  readonly describeApiError = describeApiError;
  readonly isRetryableApiError = isRetryableApiError;
  readonly nameBreaks = nameBreaks;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
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
        ? this.http
            .post<{ rows: any[] }>(this.endpoints.getTableRows, { ...params, json: true })
            .pipe(map(data => (Array.isArray(data?.rows) ? data.rows.map(row => this.unwrapRow(row)) : [])))
        : of([])
  });

  /**
   * Some nodes (Wire among them) return each row as `{ key, value }`: the primary key beside the stored struct.
   * The struct is what the ABI describes, so read that, unless the struct itself has fields named key and value.
   */
  private unwrapRow(row: any): any {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const keys = Object.keys(row);
    const wrapped = keys.length === 2 && keys.includes("key") && keys.includes("value");
    if (!wrapped || !row.value || typeof row.value !== "object") return row;
    const fieldNames = new Set(this.fields().map(field => field.name));
    return fieldNames.has("key") && fieldNames.has("value") ? row : row.value;
  }
  abiTableNames = computed<string[]>(() =>
    this.abiRes.hasValue() ? (this.abiRes.value()?.abi?.tables.map(table => table.name) ?? []) : []
  );
  /** Table name to its row struct, shown beside each table so a reader knows what it holds. */
  tableTypes = computed(() => {
    const tables = this.abiRes.hasValue() ? (this.abiRes.value()?.abi?.tables ?? []) : [];
    return new Map(tables.map(table => [table.name, table.type] as const));
  });
  tableFilter = signal("");
  filteredTables = computed(() => {
    const filter = this.tableFilter().trim().toLowerCase();
    return filter ? this.abiTableNames().filter(name => name.includes(filter)) : this.abiTableNames();
  });
  abiActions = computed<string[]>(() => {
    const actions = this.abiRes.hasValue() ? this.abiRes.value()?.abi?.actions : null;
    return Array.isArray(actions) ? actions.map(action => action?.name).filter((name): name is string => typeof name === "string") : [];
  });

  scopeLabel(scope: string): string {
    const symbol = symbolFromScope(scope);
    return symbol ? `${symbol} · ${scope}` : scope;
  }

  /** A row is named by its first scalar field (usually its key, like the owner), falling back to its position. */
  rowTitle(row: Record<string, unknown>, index: number): string {
    const first = this.fields()[0];
    const value = first ? row?.[first.name] : undefined;
    if (value === null || value === undefined || typeof value === "object" || value === "") return `Row ${index + 1}`;
    const text = String(value);
    return text.length > 32 ? text.slice(0, 31) + "…" : text;
  }

  /** A collapsed row still says something: the next two scalar fields after the one that titles it. */
  rowPreview(row: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const field of this.fields().slice(1)) {
      const value = row?.[field.name];
      if (value === null || value === undefined || typeof value === "object") continue;
      const text = String(value);
      parts.push(`${field.name} ${text.length > 40 ? text.slice(0, 39) + "…" : text}`);
      if (parts.length === 2) break;
    }
    return parts.join(" · ");
  }

  private listedScopes = computed<string[]>(() =>
    this.tableScopesRes.hasValue() ? (this.tableScopesRes.value()?.rows?.map(row => row.scope) ?? []) : []
  );
  /**
   * When a node lists no scopes for a table (Wire does this for its system contract's tables), the contract's own
   * account is still where most single-scope tables keep their rows, so offer it instead of a dead end.
   */
  scopesUnlisted = computed(
    () => this.tableScopesRes.hasValue() && !this.tableScopesRes.error() && !this.scopeLb() && !this.listedScopes().length
  );
  scopeList = computed<string[]>(() => {
    const code = this.code();
    return this.scopesUnlisted() && code ? [code] : this.listedScopes();
  });
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
      // The dialog keeps its state in the query string; replacing it means Back closes the dialog's page, not each table.
      await this.router.navigate([], { queryParams: { table: name }, replaceUrl: true });
      this.scrollElementIntoView("scope-section");
      // this.scrollToBottom();
    } else {
      await this.router.navigate(["contract", this.code(), name]);
    }
  }

  async selectScope(name: string, automatic = false) {
    if (!name) return;
    this.scope.set(name);
    this.expandedItems.set(new Set<number>());
    this.autoExpanded.set(false);
    // A scope picked for the visitor replaces the URL, so Back still returns to where they were.
    if (this.navMode() === "dialog") {
      await this.router.navigate([], { queryParams: { table: this.table(), scope: name }, replaceUrl: true });
      if (!automatic) this.scrollElementIntoView("data-section");
    } else {
      await this.router.navigate(["contract", this.code(), this.table(), name], { replaceUrl: automatic });
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
        // Only scroll when the section is out of view (the stacked phone layout); otherwise keep the header put.
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        element.scrollIntoView({ behavior: motion, block: "nearest", inline: "nearest" });
      }, 100);
    }
  }

  useNextScope(): void {
    if (!this.nextScope()) return;
    this.scopeHistory.update(values => [...values, this.scopeLb()]);
    this.scopeLb.set(this.nextScope());
  }

  constructor() {
    // Keep the open table visible in the list, which scrolls on its own inside the dialog and the page.
    afterRenderEffect(() => {
      const table = this.table();
      if (!table || !this.abiTableNames().length) return;
      const list = this.host.nativeElement.querySelector<HTMLElement>(".cx-table-list");
      const button = list?.querySelector<HTMLElement>(".grid-item-btn.selected");
      if (!list || !button) return;
      const top = button.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + button.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = Math.max(0, top - (list.clientHeight - button.offsetHeight) / 2);
      }
    });
    // A table with a single scope (or none listed) has nothing to choose: open it.
    effect(() => {
      if (!isPlatformBrowser(this.platformId) || this.scope() || !this.table() || this.tableScopesRes.isLoading()) return;
      const scopes = this.scopeList();
      if (scopes.length === 1 && !this.nextScopePresent() && !this.scopeLb()) void this.selectScope(scopes[0], true);
    });
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
