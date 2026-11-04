import {inject, Injectable, resource, signal} from '@angular/core';
import {fromEvent, lastValueFrom, takeUntil} from "rxjs";
import {DataService} from "./data.service";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class BlockService {
  data = inject(DataService);
  httpClient = inject(HttpClient);

  blockId = signal<string>("");
  blockNum = signal<number>(0);

  blockResource = resource<any, any>({
    params: () => {
      return {
        id: this.blockId(),
        block_num: this.blockNum(),
      };
    },
    loader: async ({params, abortSignal}) => {
      const body = {} as any;
      if (params.id) {
        body.block_id = params.id;
      } else if (params.block_num) {
        body.block_num = params.block_num;
      } else {
        return null;
      }
      const url = this.data.env.hyperionApiUrl + '/v1/trace_api/get_block';
      try {
        return await lastValueFrom(this.httpClient.post(url, body).pipe(takeUntil(fromEvent(abortSignal, 'abort'))));
      } catch (historyError) {
        if (abortSignal.aborted || !(historyError instanceof HttpErrorResponse)
          || ![404, 500, 502, 503, 504].includes(historyError.status)) throw historyError;
        try {
          const header = await lastValueFrom(this.httpClient.post<any>(
            this.data.env.hyperionApiUrl + '/v1/chain/get_block',
            {block_num_or_id: params.id || params.block_num}
          ).pipe(takeUntil(fromEvent(abortSignal, 'abort'))));
          if (!header || !Number.isSafeInteger(header.block_num) || header.block_num < 1 || header.block_num > 0xffffffff
            || typeof header.id !== 'string' || !/^[a-f0-9]{64}$/i.test(header.id)
            || Number.parseInt(header.id.slice(0, 8), 16) !== header.block_num
            || (params.id ? header.id.toLowerCase() !== params.id.toLowerCase() : header.block_num !== params.block_num)
            || typeof header.previous !== 'string' || !/^[a-f0-9]{64}$/i.test(header.previous)
            || typeof header.producer !== 'string' || !header.producer
            || typeof header.timestamp !== 'string' || !Number.isFinite(Date.parse(header.timestamp))) throw historyError;
          // A chain header does not establish whether any transaction traces are available.
          return {id: header.id.toLowerCase(), number: header.block_num, previous_id: header.previous,
            producer: header.producer, timestamp: header.timestamp, transactions: [], historyUnavailable: true};
        } catch {
          throw historyError;
        }
      }
    }
  });

  constructor() {
  }
}
