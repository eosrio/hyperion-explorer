import {inject, Injectable, resource, signal} from '@angular/core';
import {GetActionsResponse, GetDeltasResponse} from "../interfaces";
import {fromEvent, lastValueFrom, takeUntil} from "rxjs";
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
  private refreshRevision = signal(0);

  private blockQuery(blockNum: number | null, blockId: string | null): string {
    const query = new URLSearchParams();
    if (blockNum) query.set('block_num', blockNum.toString());
    if (blockId) query.set('block_id', blockId);
    return query.toString();
  }

  reloadCurrentBlock(): void {
    this.queryCache.delete(this.blockQuery(this.blockNum(), this.blockId()));
    this.refreshRevision.update(revision => revision + 1);
  }

  // actions Resource
  public deltasResource = resource<GetDeltasResponse, {
    blockNum: number | null,
    blockId: string | null,
    refreshRevision: number
  }>({
    params: () => {
      return {
        blockNum: this.blockNum(),
        blockId: this.blockId(),
        refreshRevision: this.refreshRevision()
      };
    },
    loader: async ({params, abortSignal}) => {
      const {blockNum, blockId} = params;
      if (blockNum || blockId) {
        const key = this.blockQuery(blockNum, blockId);
        if (this.queryCache.has(key)) {
          return this.queryCache.get(key);
        } else {
          const url = this.data.env.hyperionApiUrl + '/v2/history/get_deltas?' + key;
          const res = await lastValueFrom(this.httpClient.get<GetDeltasResponse>(url).pipe(takeUntil(fromEvent(abortSignal, 'abort'))));
          // console.log('Query Time', res.query_time_ms);
          if (params.refreshRevision === this.refreshRevision()) this.queryCache.set(key, res);
          return res;
        }
      } else {
        return {deltas: []} as unknown as GetDeltasResponse;
      }
    }
  });
}
