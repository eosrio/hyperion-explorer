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
        console.log('Chain Info:', info);
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
}
