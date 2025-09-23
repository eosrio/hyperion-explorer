import {inject, Injectable, resource, signal} from '@angular/core';
import {lastValueFrom} from "rxjs";
import {DataService} from "./data.service";
import {HttpClient} from "@angular/common/http";

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
    loader: async ({params}) => {
      const body = {} as any;
      if (params.id) {
        body.block_id = params.id;
      } else if (params.block_num) {
        body.block_num = params.block_num;
      } else {
        return null;
      }
      const url = this.data.env.hyperionApiUrl + '/v1/trace_api/get_block';
      const data = await lastValueFrom(this.httpClient.post(url, body));
      // console.log('blockData', data);
      return data;
    }
  });

  constructor() {
  }
}
