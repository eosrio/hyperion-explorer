import {inject, Injectable, resource, signal} from '@angular/core';
import {fromEvent, lastValueFrom, takeUntil} from "rxjs";
import {DataService} from "./data.service";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";

function validBlockTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z?$/.exec(value);
  if (!parts) return false;
  const iso = parts[1] + '.' + (parts[2] || '').padEnd(3, '0').slice(0, 3) + 'Z';
  const date = new Date(iso);
  return Number.isFinite(date.valueOf()) && date.toISOString() === iso;
}

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
            || (header.block_num === 1 ? header.previous !== '0'.repeat(64)
              : Number.parseInt(header.previous.slice(0, 8), 16) !== header.block_num - 1)
            || typeof header.producer !== 'string' || !header.producer
            || !validBlockTimestamp(header.timestamp)) throw historyError;
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
