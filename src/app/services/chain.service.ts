import { asUtcTimestamp } from "../utils";
import { computed, inject, Injectable, resource, signal } from "@angular/core";
import { lastValueFrom } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { DataService } from "./data.service";

// Define an interface for the expected structure of the /v1/chain/get_info response
interface ChainInfo {
  server_version: string;
  chain_id: string;
  head_block_num: number;
  last_irreversible_block_num: number;
  last_irreversible_block_id: string;
  head_block_id: string;
  head_block_time: string; // ISO 8601 format date string
  head_block_producer: string;
  virtual_block_cpu_limit: number;
  virtual_block_net_limit: number;
  block_cpu_limit: number;
  block_net_limit: number;
  server_version_string?: string; // Optional, might exist on some chains
  fork_db_head_block_num?: number;
  fork_db_head_block_id?: string;
  server_full_version_string?: string;
}

// Interface for the structure of a single producer row from get_producers
interface ProducerRow {
  owner: string;
  total_votes: string; // Usually a string representing a large number
  producer_key: string;
  is_active: number; // 1 if active, 0 otherwise
  url: string;
  unpaid_blocks: number;
  last_claim_time: string;
  location: number; // Often a number code, might need mapping or interpretation
  producer_authority?: any; // Can be complex, ignore for now
  // Additional fields might exist depending on the chain (e.g., producer_json)
  bp_json?: any; // Sometimes BP info is here
}

// Interface for the full /v1/chain/get_producers response
interface GetProducersResponse {
  rows: ProducerRow[];
  total_producer_vote_weight: string;
  more: string; // Indicates if more producers are available (pagination)
}

/** Antelope chains produce a block every half second; two seconds keeps the head visibly moving at a modest API cost. */
export const LIVE_HEAD_INTERVAL_MS = 2_000;
export const LIVE_HEAD_RETRY_MS = 10_000;

@Injectable({
  providedIn: "root"
})
export class ChainService {
  data = inject(DataService);
  httpClient = inject(HttpClient);

  // Resource to fetch and store the full chain info
  readonly lastUpdatedAt = signal<number | null>(null);
  chainInfoResource = resource<ChainInfo | null, void>({
    loader: async () => {
      const info = await lastValueFrom(this.httpClient.get<ChainInfo>(this.data.env.hyperionApiUrl + "/v1/chain/get_info"));
      this.lastUpdatedAt.set(Date.now());
      return { ...info, server_version_string: info.server_version_string || info.server_version };
    }
  });

  oracleData = resource<any, any>({
    params: () => ({
      explorerMetadata: this.data.explorerMetadata()
    }),
    loader: async ({ params }) => {
      try {
        const oracleConfig = params.explorerMetadata?.oracle;
        if (!oracleConfig) {
          return null;
        }

        const { contract, table } = oracleConfig;
        if (!contract || !table) {
          return null;
        }

        const getTableRows = this.data.env.hyperionApiUrl + "/v1/chain/get_table_rows";
        const data = (await lastValueFrom(
          this.httpClient.post(getTableRows, {
            code: contract,
            scope: contract,
            table: table,
            limit: 1,
            json: true
          })
        )) as any;
        if (data && data.rows && data.rows.length > 0) {
          return data.rows[0];
        } else {
          return null;
        }
      } catch (e: any) {
        console.log(e.message);
        return null;
      }
    }
  });

  priceRateUsd = computed<number | null>(() => {
    try {
      const raw = this.oracleData.value()?.latest_rate?.price;
      if (typeof raw !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?(?:\s|$)/.test(raw)) return null;
      const price = Number(raw.split(" ")[0]);
      return Number.isFinite(price) ? price : null;
    } catch {
      return null;
    }
  });

  /** The chain's own system accounts (for example sysio and sysio.token on Wire), never assumed to be eosio. */
  systemContract = computed(() => this.data.explorerMetadata()?.system_contract || "eosio");
  systemTokenContract = computed(() => `${this.systemContract()}.token`);

  /**
   * Whether this API serves token holder rankings. Probed once with a token the visitor is looking at, so token
   * rows only link to a top-holders page that can load.
   */
  private topHoldersProbe = signal<{ contract: string; symbol: string } | null>(null);
  topHoldersAvailable = resource<boolean, { contract: string; symbol: string } | undefined>({
    params: () => this.topHoldersProbe() ?? undefined,
    loader: async ({ params, abortSignal }) => {
      const query = new URLSearchParams({ contract: params.contract, symbol: params.symbol, limit: "1" });
      const response = await fetch(`${this.data.env.hyperionApiUrl}/v2/state/get_top_holders?${query}`, { signal: abortSignal });
      return response.ok;
    }
  });

  probeTopHolders(contract: string, symbol: string): void {
    if (!this.topHoldersProbe()) this.topHoldersProbe.set({ contract, symbol });
  }

  systemSymbol = resource<string, string | undefined>({
    params: () => (this.data.explorerMetadata() ? this.systemContract() : undefined),
    loader: async ({ params: systemContract }) => {
      try {
        const abi = await lastValueFrom(this.httpClient.post<{ abi?: { tables?: { name?: string }[] } }>(
          this.data.env.hyperionApiUrl + "/v1/chain/get_abi", { account_name: systemContract }
        ));
        if (!Array.isArray(abi?.abi?.tables) || !abi.abi.tables.some(table => table?.name === "rammarket")) return "SYS";
        const getTableRows = this.data.env.hyperionApiUrl + "/v1/chain/get_table_rows";
        const ramMarket = (await lastValueFrom(
          this.httpClient.post(getTableRows, {
            code: systemContract,
            scope: systemContract,
            table: "rammarket",
            limit: 1,
            json: true
          })
        )) as any;
        if (ramMarket && ramMarket.rows && ramMarket.rows.length > 0) {
          const row = ramMarket.rows[0];
          if (row.quote && row.quote.balance) {
            return row.quote.balance.split(" ")[1];
          } else if (row.core_reserve) {
            return row.core_reserve.split(" ")[1];
          } else {
            return "SYS";
          }
        } else {
          return "SYS";
        }
      } catch (e: any) {
        console.log(e.message);
        return "SYS";
      }
    }
  });

  // Computed signals for specific chain info fields
  chainInfo = computed(() => (this.chainInfoResource.hasValue() ? this.chainInfoResource.value() : null));
  streamLib = signal(0);

  lastIrreversibleBlockNum = computed(() => Math.max(this.streamLib(), this.chainInfo()?.last_irreversible_block_num || 0));

  chainId = computed(() => this.chainInfo()?.chain_id ?? "N/A");
  headBlockNum = computed(() => this.chainInfo()?.head_block_num ?? 0);
  headBlockTime = computed(() => (this.chainInfo()?.head_block_time ? asUtcTimestamp(this.chainInfo()!.head_block_time) : null)); // Keep as string or null
  serverVersion = computed(() => this.chainInfo()?.server_version_string ?? this.chainInfo()?.server_version ?? "N/A");

  // Resource to fetch producer data
  producersResource = resource<GetProducersResponse | null, void>({
    loader: async () => {
      const producers = await lastValueFrom(
        this.httpClient.post<GetProducersResponse>(this.data.env.hyperionApiUrl + "/v1/chain/get_producers", { json: true, limit: 1000 })
      );
      producers.rows.sort((a, b) => parseFloat(b.total_votes) - parseFloat(a.total_votes));
      await this.addUnlistedProducers(producers);
      return producers;
    }
  });

  /**
   * Some nodes (Wire's among them) stop get_producers at the active schedule and ignore lower_bound, so registered
   * producers beyond it never appear. The system contract's producers table holds all of them: append the active
   * ones get_producers left out. Any failure keeps the get_producers answer as it was.
   */
  private async addUnlistedProducers(producers: GetProducersResponse): Promise<void> {
    // Only a complete-looking, non-empty answer can be short: paginated or empty answers are left as they are.
    if (producers.more || !producers.rows?.length) return;
    const code = this.systemContract();
    try {
      const table = await lastValueFrom(
        this.httpClient.post<{ rows: unknown[] }>(this.data.env.hyperionApiUrl + "/v1/chain/get_table_rows", {
          code,
          table: "producers",
          scope: code,
          limit: 1000,
          json: true
        })
      );
      const listed = new Set(producers.rows.map(row => row.owner));
      for (const raw of table?.rows ?? []) {
        // Rows may come wrapped as { key, value } (Wire) or plain.
        const row = (raw && typeof raw === "object" && "value" in raw && "key" in raw ? (raw as { value: unknown }).value : raw) as Partial<ProducerRow>;
        if (!row || typeof row.owner !== "string" || listed.has(row.owner) || !Number(row.is_active)) continue;
        listed.add(row.owner);
        producers.rows.push({
          owner: row.owner,
          total_votes: row.total_votes ?? "",
          producer_key: row.producer_key ?? "",
          is_active: 1,
          url: row.url ?? "",
          unpaid_blocks: row.unpaid_blocks ?? 0,
          last_claim_time: row.last_claim_time ?? "",
          location: row.location ?? 0,
          producer_authority: row.producer_authority
        });
      }
    } catch {
      // The table is optional: chains with a different system contract simply keep get_producers' list.
    }
  }

  // Computed signal for the producer rows, sorted by votes
  producers = computed(() => (this.producersResource.hasValue() ? (this.producersResource.value()?.rows ?? []) : []));

  // Method to refresh the chain info
  refreshChainInfo() {
    console.log("Refreshing Chain Info...");
    this.chainInfoResource.reload();
  }

  /** When live head polling last failed; cleared by the next successful poll. */
  readonly liveFailedAt = signal<number | null>(null);
  private liveUsers = 0;
  private liveTimer?: ReturnType<typeof setTimeout>;

  /**
   * Keep the chain head current while a view needs it (the home pulse). Polls get_info every two seconds while the
   * page is visible, writing results straight into chainInfo so nothing flips into a loading state, and backs off to
   * ten seconds while the API is failing. Returns the function that stops this view's interest.
   */
  startLiveHead(): () => void {
    this.liveUsers++;
    if (this.liveUsers === 1) this.scheduleLiveHead(LIVE_HEAD_INTERVAL_MS);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.liveUsers--;
      if (this.liveUsers === 0) clearTimeout(this.liveTimer);
    };
  }

  private scheduleLiveHead(delay: number): void {
    clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(() => void this.pollLiveHead(), delay);
  }

  private async pollLiveHead(): Promise<void> {
    if (this.liveUsers === 0) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      this.scheduleLiveHead(LIVE_HEAD_INTERVAL_MS);
      return;
    }
    try {
      const info = await lastValueFrom(this.httpClient.get<ChainInfo>(this.data.env.hyperionApiUrl + "/v1/chain/get_info"));
      if (this.liveUsers === 0) return;
      this.chainInfoResource.set({ ...info, server_version_string: info.server_version_string || info.server_version });
      this.lastUpdatedAt.set(Date.now());
      this.liveFailedAt.set(null);
      this.scheduleLiveHead(LIVE_HEAD_INTERVAL_MS);
    } catch {
      if (this.liveUsers === 0) return;
      if (this.liveFailedAt() === null) this.liveFailedAt.set(Date.now());
      this.scheduleLiveHead(LIVE_HEAD_RETRY_MS);
    }
  }
}
