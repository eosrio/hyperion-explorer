import {inject, Injectable, makeStateKey, TransferState} from '@angular/core';
import {environment} from "../../env";
import {ExplorerMetadata} from "../interfaces";
import {Title} from "@angular/platform-browser";

export abstract class DataService {
  abstract explorerMetadata: ExplorerMetadata | null;
  abstract initError: string | null;

  abstract load(): Promise<void>;
}

@Injectable({providedIn: 'root'})
export class DataServiceServer extends DataService {

  state = inject(TransferState);
  explorerMetadata: ExplorerMetadata | null = null;
  initError: string | null = null;

  async load() {
    // fetch explorer metadata
    await this.loadChainData();
  }

  async loadChainData(): Promise<void> {
    const url = environment.hyperionApiUrl + '/v2/explorer_metadata';
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data: ExplorerMetadata = await response.json();
        if (data && data.last_indexed_block && data.last_indexed_block > 1) {
          data.logo = environment.hyperionApiUrl + '/v2/explorer_logo';
          this.state.set(makeStateKey<Awaited<ReturnType<ExplorerMetadata | any>>>('chain_data'), data);
          this.explorerMetadata = data;
        } else {
          this.initError = `Error fetching ${url}: Invalid response`;
          this.state.set(makeStateKey<string>('init_error'), this.initError);
        }
      } else {
        this.initError = `Error fetching ${url}: ${response.statusText}`;
        this.state.set(makeStateKey<string>('init_error'), this.initError);
      }
    } catch (error: any) {
      this.initError = `Error fetching ${url}: ${error.message}`;
      this.state.set(makeStateKey<string>('init_error'), this.initError);
    }
  }
}

@Injectable({providedIn: 'root'})
export class DataServiceBrowser extends DataService {
  state = inject(TransferState);
  initError: string | null = null;
  explorerMetadata: ExplorerMetadata | null = null;

  constructor(private title: Title) {
    super();
  }

  async load() {
    this.explorerMetadata = this.state.get(makeStateKey<ExplorerMetadata>('chain_data'), null);
    this.initError = this.state.get(makeStateKey<string>('init_error'), null);
    if (this.explorerMetadata) {
      this.title.setTitle(`${this.explorerMetadata.chain_name} Hyperion Explorer`);
    }
  }
}
