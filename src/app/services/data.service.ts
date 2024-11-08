import {inject, Injectable, makeStateKey, TransferState} from '@angular/core';
import {environment} from "../../env";
import {ExplorerMetadata} from "../interfaces";
import {Title} from "@angular/platform-browser";

export abstract class DataService {
  abstract explorerMetadata: ExplorerMetadata | null;
  abstract load(): Promise<void>;
}

@Injectable({providedIn: 'root'})
export class DataServiceServer extends DataService {
  state = inject(TransferState);
  explorerMetadata: ExplorerMetadata | null = null;

  async load() {
    console.log("Loading chain data...");
    // fetch explorer metadata
    await this.loadChainData();
  }

  async loadChainData(): Promise<void> {
    try {
      const response = await fetch(environment.hyperionApiUrl + '/v2/explorer_metadata');
      const data: ExplorerMetadata = await response.json();
      if (data && data.last_indexed_block && data.last_indexed_block > 1) {
        data.logo = environment.hyperionApiUrl + '/v2/explorer_logo';
        this.state.set(makeStateKey<Awaited<ReturnType<ExplorerMetadata | any>>>('chain_data'), data);
        this.explorerMetadata = data;
      } else {
        console.error("Unable to fetch explorer metadata!");
      }
      // const data = await lastValueFrom(this.http.get(environment.hyperionApiUrl + '/v2/explorer_metadata')) as ExplorerMetadata;
      // if(data && data.last_indexed_block && data.last_indexed_block > 1) {
      //   console.log(data);
      //   data.logo = environment.logo;
      //   this.meta.set(data);
      //   this.title.setTitle(`${data.chain_name} Hyperion Explorer`);
      // } else {
      //   console.error("Unable to fetch explorer metadata!");
      // }
    } catch (error) {
      console.log(error);
    }
  }
}

@Injectable({providedIn: 'root'})
export class DataServiceBrowser extends DataService {
  state = inject(TransferState);
  explorerMetadata: ExplorerMetadata | null = null;

  constructor(private title: Title) {
    super();
  }

  async load() {
    this.explorerMetadata = this.state.get(makeStateKey<ExplorerMetadata>('chain_data'), null);
    if (this.explorerMetadata) {
      this.title.setTitle(`${this.explorerMetadata.chain_name} Hyperion Explorer`);
    }
  }
}
