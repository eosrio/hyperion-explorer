import {computed, effect, inject, Injectable, resource} from '@angular/core';
import {lastValueFrom} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {DataService} from "./data.service";

@Injectable({
  providedIn: 'root'
})
export class ChainService {

  data = inject(DataService);
  httpClient = inject(HttpClient);

  libNumberResource = resource<number, any>({
    loader: async () => {
      console.log('Checking LIB...');
      const lib = await this.checkLib() ?? 0;
      console.log('LIB:', lib);
      return lib;
    }
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

  libNumber = computed<number>(() => {
    return this.libNumberResource.value() ?? 0;
  });

  async checkLib(): Promise<number | null> {
    try {
      const info = await lastValueFrom(this.httpClient.get(this.data.env.hyperionApiUrl + '/v1/chain/get_info')) as any;
      if (info) {
        return info.last_irreversible_block_num;
      } else {
        return null;
      }
    } catch (e: any) {
      console.log(e.message);
      return null;
    }
  }

  constructor() {
    // effect(() => {
    //   console.log(`Oracle Data`, this.oracleData.value());
    // });
  }
}
