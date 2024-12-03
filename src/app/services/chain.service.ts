import {computed, inject, Injectable, resource} from '@angular/core';
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
          return ramMarket.rows[0].quote.balance.split(' ')[1];
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
  }
}
