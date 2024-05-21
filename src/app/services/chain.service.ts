import {afterNextRender, Inject, Injectable, PLATFORM_ID, signal} from '@angular/core';
import {isPlatformServer} from "@angular/common";
import {environment} from "../../env";
import {HttpClient} from "@angular/common/http";
import {lastValueFrom} from "rxjs";
import {Title} from "@angular/platform-browser";
import {ExplorerMetadata} from "../interfaces";

@Injectable({
  providedIn: 'root'
})
export class ChainService {

  meta = signal<ExplorerMetadata>({} as ExplorerMetadata);

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private http: HttpClient, private title: Title) {
    if (isPlatformServer(this.platformId)) {
      this.loadChainData().catch(console.error);
    } else {
      console.log(this.meta());
    }
  }

  async loadChainData(): Promise<void> {
    try {
      const data = await lastValueFrom(this.http.get(environment.hyperionApiUrl + '/v2/explorer_metadata')) as ExplorerMetadata;
      if(data && data.last_indexed_block && data.last_indexed_block > 1) {
        console.log(data);
        data.logo = environment.logo;
        this.meta.set(data);
        this.title.setTitle(`${data.chain_name} Hyperion Explorer`);
      } else {
        console.error("Unable to fetch explorer metadata!");
      }
    } catch (error) {
      console.log(error);
    }
  }
}
