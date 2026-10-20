import { inject, Injectable, makeStateKey, signal, TransferState } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { ExplorerMetadata } from "../interfaces";
import { describeApiError } from "../api-errors";

export abstract class DataService {
  env = {
    hyperionApiUrl: "",
    streamApiUrl: "",
    systemContract: "eosio",
    userResourcesTable: "userres",
    defaultTicker: ""
  };
  metadataKey = makeStateKey<ExplorerMetadata>("chain_data");
  initErrorKey = makeStateKey<string>("init_error");
  themesKey = makeStateKey<string[]>("available_themes");
  explorerMetadata = signal<ExplorerMetadata | null>(null);
  initError: string | null = null;
  customTheme?: Record<string, string>;
  routeError?: string = "";
  availableThemes: string[] = [];
  ready = signal(false);
  url = () => this.env.hyperionApiUrl + "/v2/explorer_metadata";

  abstract load(): Promise<void>;
  abstract activateTheme(): Promise<void>;

  setOrigin(hyperionServer: string): void {
    const url = new URL(hyperionServer);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("The Hyperion API URL must use HTTP or HTTPS.");
    }
    this.env.hyperionApiUrl = url.origin;
  }

  async loadChainData(): Promise<void> {
    this.initError = null;
    this.explorerMetadata.set(null);
    try {
      const response = await fetch(this.url(), { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(describeApiError({ status: response.status }));
      const data = (await response.json()) as ExplorerMetadata;
      // Indexing progress is independent of chain identity and may be absent at startup.
      if (!data || typeof data.chain_id !== "string" || !data.chain_id || typeof data.chain_name !== "string" || !data.chain_name) {
        throw new Error("The Hyperion API returned invalid explorer metadata.");
      }
      this.explorerMetadata.set({
        ...data,
        logo: this.env.hyperionApiUrl + "/v2/explorer_logo",
        theme: this.customTheme ?? data.theme ?? {},
        last_indexed_block: data.last_indexed_block ?? 0,
        last_indexed_block_time: data.last_indexed_block_time ?? ""
      });
    } catch (error) {
      this.initError = describeApiError(error);
    }
  }
}

@Injectable({ providedIn: "root" })
export class DataServiceServer extends DataService {
  private state = inject(TransferState);
  async activateTheme(): Promise<void> {}

  async load(): Promise<void> {
    this.state.remove(this.metadataKey);
    this.state.remove(this.initErrorKey);
    await this.loadChainData();
    const data = this.explorerMetadata();
    if (data) this.state.set(this.metadataKey, data);
    if (this.initError) this.state.set(this.initErrorKey, this.initError);
    this.state.set(this.themesKey, this.availableThemes);
  }
}

@Injectable({ providedIn: "root" })
export class DataServiceBrowser extends DataService {
  private title = inject(Title);
  private state = inject(TransferState);

  async load(): Promise<void> {
    this.explorerMetadata.set(this.state.get(this.metadataKey, null));
    this.initError = this.state.get(this.initErrorKey, null);
    this.availableThemes = this.state.get(this.themesKey, []);
    if (!this.explorerMetadata()) await this.loadChainData();
    const data = this.explorerMetadata();
    if (data) {
      // Browser storage may be disabled or contain an override from an older build.
      try {
        const saved = localStorage.getItem("theme-override");
        const theme: unknown = saved ? JSON.parse(saved) : null;
        if (
          theme &&
          typeof theme === "object" &&
          !Array.isArray(theme) &&
          Object.entries(theme).every(([key, value]) => key.startsWith("--") && typeof value === "string")
        ) {
          this.explorerMetadata.set({ ...data, theme: { ...data.theme, ...theme } });
        }
      } catch {
        /* Keep the deployment theme when browser storage is unavailable. */
      }
      this.title.setTitle(`${data.chain_name} Hyperion Explorer`);
    }
    this.state.remove(this.metadataKey);
    this.state.remove(this.initErrorKey);
  }

  async activateTheme(): Promise<void> {
    for (const [key, value] of Object.entries(this.explorerMetadata()?.theme ?? {})) {
      if (key.startsWith("--") && typeof value === "string") {
        document.documentElement.style.setProperty(key, value);
      }
    }
    this.ready.set(true);
  }
}
