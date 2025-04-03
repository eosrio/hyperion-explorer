import { computed, effect, inject, Injectable, resource, signal } from '@angular/core';
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


@Injectable({
  providedIn: 'root'
})
export class ChainService {

  data = inject(DataService);
  httpClient = inject(HttpClient);

  // Resource to fetch and store the full chain info
  chainInfoResource = resource<ChainInfo | null, void>({
    loader: async () => {
      console.log('Fetching Chain Info...');
      try {
        const info = await lastValueFrom(this.httpClient.get<ChainInfo>(this.data.env.hyperionApiUrl + '/v1/chain/get_info'));
        // Add server_version_string if it doesn't exist but server_version does (for compatibility)
        if (info && !info.server_version_string && info.server_version) {
          info.server_version_string = info.server_version;
        }
        return info;
      } catch (e: any) {
        console.error('Failed to fetch chain info:', e.message);
        return null;
      }
    }
    // Removed initialValue as it's not a valid option
  });


  oracleData = resource<any, any>({
    loader: async () => {
      try {
        const getTableRows = this.data.env.hyperionApiUrl + '/v1/chain/get_table_rows';
        const data = await lastValueFrom(this.httpClient.post(getTableRows, {
          code: "eosio.oracle",
          scope: "eosio.oracle",
          table: "lastknwnrate",
          limit: 1,
          json: true
        })) as any;
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

  priceRateUsd = computed<number>(() => {
    try {
      const data = this.oracleData.value();
      if (data && data.latest_rate && data.latest_rate.price) {
        return parseFloat(data.latest_rate.price.split(' ')[0]);
      } else {
        return 0;
      }
    } catch (e: any) {
      console.log('Failed to parse USD Rate from oracle', e.message);
      return 0;
    }
  });

  systemSymbol = resource<string, any>({
    loader: async () => {
      try {
        const getTableRows = this.data.env.hyperionApiUrl + '/v1/chain/get_table_rows';
        const ramMarket = await lastValueFrom(this.httpClient.post(getTableRows, {
          code: "eosio",
          scope: "eosio",
          table: "rammarket",
          limit: 1,
          json: true
        })) as any;
        if (ramMarket && ramMarket.rows && ramMarket.rows.length > 0) {
          const row = ramMarket.rows[0];
          if (row.quote && row.quote.balance) {
            return row.quote.balance.split(' ')[1];
          } else if (row.core_reserve) {
            return row.core_reserve.split(' ')[1];
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
  chainInfo = computed(() => this.chainInfoResource.value());
  lastIrreversibleBlockNum = computed(() => this.chainInfo()?.last_irreversible_block_num ?? 0);
  chainId = computed(() => this.chainInfo()?.chain_id ?? 'N/A');
  headBlockNum = computed(() => this.chainInfo()?.head_block_num ?? 0);
  headBlockTime = computed(() => this.chainInfo()?.head_block_time ?? null); // Keep as string or null
  serverVersion = computed(() => this.chainInfo()?.server_version_string ?? this.chainInfo()?.server_version ?? 'N/A');


  constructor() {
    // Optional: Log when chain info changes
    // effect(() => {
    //   console.log(`Chain Info Updated`, this.chainInfo());
    // });
  }

  // Resource to fetch producer data
  producersResource = resource<GetProducersResponse | null, void>({
    loader: async () => {
      console.log('Fetching Producers...');
      try {
        // Standard endpoint, might need adjustment based on specific Hyperion config
        const producers = await lastValueFrom(this.httpClient.post<GetProducersResponse>(this.data.env.hyperionApiUrl + '/v1/chain/get_producers', {
          json: true,
          limit: 1000 // Fetch a large number, assuming pagination isn't needed for typical top producer lists
        }));

        // Sort producers by total_votes descending to easily determine rank later
        if (producers && producers.rows) {
          producers.rows.sort((a, b) => parseFloat(b.total_votes) - parseFloat(a.total_votes));
        }

        return producers;
      } catch (e: any) {
        console.error('Failed to fetch producers:', e.message);
        return null;
      }
    }
  });

  // Computed signal for the producer rows, sorted by votes
  producers = computed(() => this.producersResource.value()?.rows ?? []);

}
