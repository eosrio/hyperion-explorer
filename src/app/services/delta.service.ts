import {inject, Injectable, resource, signal} from '@angular/core';
import {GetActionsResponse, GetDeltasResponse} from "../interfaces";
import {lastValueFrom} from "rxjs";
import {DataService} from "./data.service";
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class DeltaService {

  data = inject(DataService);
  httpClient = inject(HttpClient);

  queryCache = new Map<string, any>();

  blockNum = signal<number | null>(null);
  blockId = signal<string | null>(null);

  // actions Resource
  public deltasResource = resource<GetDeltasResponse, {
    blockNum: number | null,
    blockId: string | null
  }>({
    request: () => {
      return {
        blockNum: this.blockNum(),
        blockId: this.blockId()
      };
    },
    loader: async (param) => {
      const {blockNum, blockId} = param.request;
      if (blockNum || blockId) {
        const query = new URLSearchParams();
        if (blockNum) {
          query.set('block_num', blockNum.toString());
        }
        if (blockId) {
          query.set('block_id', blockId);
        }
        const key = query.toString();
        if (this.queryCache.has(key)) {
          return this.queryCache.get(key);
        } else {
          const url = this.data.env.hyperionApiUrl + '/v2/history/get_deltas?' + key;
          const res = await lastValueFrom(this.httpClient.get(url)) as GetDeltasResponse;
          console.log('Query Time', res.query_time_ms);
          this.queryCache.set(key, res);
          return res;
        }
      } else {
        return {deltas: []} as unknown as GetDeltasResponse;
      }
    }
  });
}
