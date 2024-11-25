import {inject, Injectable, makeStateKey, signal, TransferState} from '@angular/core';
import {ExplorerMetadata} from "../interfaces";
import {Title} from "@angular/platform-browser";

export abstract class DataService {

  env = {
    hyperionApiUrl: '',
    systemContract: 'eosio',
    userResourcesTable: 'userres'
  };

  metadataKey = makeStateKey<ExplorerMetadata>('chain_data');
  initErrorKey = makeStateKey<string>('init_error');

  url = () => {
    return this.env.hyperionApiUrl + '/v2/explorer_metadata';
  };

  abstract explorerMetadata: ExplorerMetadata | null;
  abstract initError: string | null;
  customTheme?: Record<string, any>;
  routeError?: string = '';

  abstract load(): Promise<void>;

  abstract activateTheme(): Promise<void>

  ready = signal(false);

  setOrigin(hyperionServer: string, platform?: string): void {
    try {
      const url = new URL(hyperionServer);
      this.env.hyperionApiUrl = url.origin;
      console.log(`(${platform}) Setting origin to:`, this.env.hyperionApiUrl);
    } catch (e) {
      console.log(hyperionServer);
      console.log('Error setting origin:', e);
    }
  }
}

@Injectable({providedIn: 'root'})
export class DataServiceServer extends DataService {

  override async activateTheme(): Promise<void> {
    console.log('activateTheme not implemented on server');
  }

  state = inject(TransferState);
  explorerMetadata: ExplorerMetadata | null = null;
  initError: string | null = null;

  async load() {
    // fetch explorer metadata on server
    if (this.env.hyperionApiUrl) {
      await this.loadChainData();
    }
  }

  async loadChainData(): Promise<void> {
    try {
      const response = await fetch(this.url());
      if (response.ok) {
        const data: ExplorerMetadata = await response.json();
        if (data && data.last_indexed_block && data.last_indexed_block > 1) {
          data.logo = this.env.hyperionApiUrl + '/v2/explorer_logo';
          if (this.customTheme) {
            data.theme = this.customTheme;
          }
          this.state.set(this.metadataKey, data);
          this.explorerMetadata = data;
        } else {
          this.initError = `Error fetching ${this.url()}: Invalid response`;
          this.state.set(this.initErrorKey, this.initError);
        }
      } else {
        this.initError = `Error fetching ${this.url()}: ${response.statusText}`;
        this.state.set(this.initErrorKey, this.initError);
      }
    } catch (error: any) {
      this.initError = `Error fetching ${this.url()}: ${error.message}`;
      this.state.set(this.initErrorKey, this.initError);
    }
  }
}

@Injectable({providedIn: 'root'})
export class DataServiceBrowser extends DataService {
  private title = inject(Title);

  state = inject(TransferState);
  initError: string | null = null;
  explorerMetadata: ExplorerMetadata | null = null;

  async load() {
    // load metadata from state on browser
    this.explorerMetadata = this.state.get(this.metadataKey, null);
    console.log('Loaded metadata from state:', this.explorerMetadata);
    this.initError = this.state.get(this.initErrorKey, null);
    if (this.explorerMetadata) {
      this.title.setTitle(`${this.explorerMetadata.chain_name} Hyperion Explorer`);
    } else {
      await this.loadChainData();
    }
  }

  async loadChainData(): Promise<void> {
    try {
      const response = await fetch(this.url());
      if (response.ok) {
        const data: ExplorerMetadata = await response.json();
        if (data && data.last_indexed_block && data.last_indexed_block > 1) {
          data.logo = this.env.hyperionApiUrl + '/v2/explorer_logo';
          if (this.customTheme) {
            data.theme = this.customTheme;
          }
          this.explorerMetadata = data;
        } else {
          this.initError = `Error fetching ${this.url()}: Invalid response`;
        }
      } else {
        this.initError = `Error fetching ${this.url()}: ${response.statusText}`;
      }
    } catch (error: any) {
      this.initError = `Error fetching ${this.url()}: ${error.message}`;
    }
  }

  override async activateTheme(): Promise<void> {
    if (this.explorerMetadata?.theme) {
      for (const [key, value] of Object.entries(this.explorerMetadata?.theme)) {
        document.documentElement.style.setProperty(key, value);
      }
    }
    this.ready.set(true);
  }
}
