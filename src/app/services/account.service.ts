import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  PLATFORM_ID,
  resource,
  ResourceLoaderParams,
  ResourceRef,
  signal,
  untracked,
  WritableSignal
} from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { AccountCreationData, AccountData, GetAccountResponse, GetActionsResponse, TokenData } from "../interfaces";
import { ActionContent, HyperionStream, HyperionStreamClient } from "@eosrio/hyperion-stream-client";
import { lastValueFrom, Observable } from "rxjs";
import { DataService } from "./data.service";
import { toObservable } from "@angular/core/rxjs-interop";
import { convertMicroS, formatBytes, getPrecision, getSymbol } from "../utils";
import { faComputer, faFilter, faMoneyBill, faRightFromBracket, faRightToBracket, faVoteYea } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/angular-fontawesome";
import { isPlatformBrowser } from "@angular/common";
import { SortDirection } from "@angular/material/sort";
import { describeApiError } from "../api-errors";
import { ChainService } from "./chain.service";
import {
  Sequence,
  HistoryAction,
  historyAction,
  historyResponse,
  previousSequence,
  nextSequence,
  compareSequences,
  mergeHistory
} from "../sequences";

interface HealthResponse {
  features: {
    streaming: {
      deltas: boolean;
      enable: boolean;
      traces: boolean;
    };
  };
}

export interface ActionFilterSpec {
  name: string;
  icon?: IconDefinition;
  userFilter?: boolean;
  exec: (params: WritableSignal<Record<string, string> | undefined>) => void;
}

export const MAX_ES_SKIP = 10000;

@Injectable({ providedIn: "root" })
export class AccountService {
  private data = inject(DataService);
  private httpClient = inject(HttpClient);
  chain = inject(ChainService);

  emptyAccount: AccountData & any = {
    cpu_limit: { used: 1, max: 1 },
    net_limit: { used: 1, max: 1 }
  };

  public tableDataSource: Observable<HistoryAction[]>;
  streamClient?: HyperionStreamClient;
  public streamClientStatus = signal(false);
  readonly streamConnecting = signal(false);
  readonly streamOnline = signal(false);
  readonly lastStreamActionAt = linkedSignal<string, number | null>({ source: () => this.accountName(), computation: () => null });
  readonly streamState = computed(() =>
    this.streamConnecting()
      ? "Connecting"
      : this.streamClientStatus()
        ? this.streamOnline()
          ? "Live connection"
          : "Reconnecting"
        : "Paused"
  );
  public libNum = signal<number>(0);
  private pendingSet = new Set<number>();
  public streamClientLoaded = false;

  // signals
  public loaded = signal(false);
  public requestError = signal<string | null>(null);
  public loadingMoreActions = signal(false);
  public accountName = signal("");
  public historyError = linkedSignal<string, string | null>({ source: this.accountName, computation: () => null });
  public customParams = signal<Record<string, string> | undefined>(undefined);

  // pagination signals
  pageIndex = signal(0);
  pageSize = signal(20);
  sortDirection = signal<SortDirection>("desc");

  filter = signal<ActionFilterSpec | null>(null);

  queryCache = new Map<string, any>();

  commonFilters: ActionFilterSpec[] = [
    // received transfers
    {
      name: "Incoming Transfers",
      icon: faRightToBracket,
      exec: params => {
        params.set({
          "@transfer.to": this.accountName()
        });
      }
    },
    // sent transfers
    {
      name: "Outgoing Transfers",
      icon: faRightFromBracket,
      exec: params => {
        params.set({
          "@transfer.from": this.accountName()
        });
      }
    },
    {
      name: "Native Transfers",
      icon: faMoneyBill,
      exec: params => {
        params.set({
          "act.account": "eosio.token",
          "act.name": "transfer"
        });
      }
    },
    {
      name: "Other Transfers",
      icon: faMoneyBill,
      exec: params => {
        params.set({
          "act.account": "!eosio.token",
          "act.name": "transfer"
        });
      }
    },
    {
      name: "System Actions",
      icon: faComputer,
      exec: params => {
        params.set({
          "act.account": "eosio"
        });
      }
    },
    // votes
    {
      name: "Votes",
      icon: faVoteYea,
      exec: params => {
        params.set({
          "act.account": "eosio",
          "act.name": "voteproducer"
        });
      }
    }
  ];

  userSavedFilters: any[] = [];

  accountActions: any[] = [];

  // actions Resource
  public actionRes = resource<
    GetActionsResponse,
    | {
        accountName: string;
        customParams?: Record<string, string>;
        limit: number;
        skip: number;
        first: Sequence | null;
        sort: string;
      }
    | undefined
  >({
    params: () => {
      if (!this.accountName() || !this.accountDataRes.hasValue()) return undefined;
      return {
        accountName: this.accountName(),
        customParams: this.customParams(),
        limit: this.pageSize(),
        skip: this.pageIndex() * this.pageSize(),
        first: this.firstGlobalSequence(),
        sort: this.sortDirection()
      };
    },
    loader: async ({ params }) => {
      const firstGS = params.first;

      // Applying queued rows advances the snapshot without ending the live subscription.
      // Filtering or leaving the newest page still pauses it for historical inspection.
      if (
        (params.customParams || params.skip > 0 || params.sort === "asc") &&
        this.streamClientStatus() &&
        this.streamClient?.online &&
        this.actionStream
      ) {
        console.log("Stopping Stream Client");
        this.stopActionStream();
        this.streamingActions.set([]);
      }

      const cp = params.customParams;
      const { limit, skip, sort } = params;
      if ((cp || skip > 0 || sort === "asc" || limit !== 20) && firstGS !== null) {
        const query = new URLSearchParams();
        query.set("account", params.accountName);
        query.set("limit", limit.toString());
        query.set("skip", skip.toString());
        // global sequence marker to lock the action on the time of a page load
        query.set("global_sequence", `0-${firstGS}`);
        if (sort) {
          query.set("sort", sort);
        }
        for (const key in cp) {
          if (cp.hasOwnProperty(key)) {
            query.set(key, cp[key]);
          }
        }
        const key = query.toString();
        if (this.queryCache.has(key)) {
          return this.queryCache.get(key);
        } else {
          const url = this.data.env.hyperionApiUrl + "/v2/history/get_actions?" + key;
          const res = historyResponse(await lastValueFrom(this.httpClient.get<GetActionsResponse>(url)));
          // console.log("Query Time", res.query_time_ms);
          this.queryCache.set(key, res);
          return res;
        }
      } else {
        return { actions: [] } as unknown as GetActionsResponse;
      }
    }
  });

  // accountData Resource
  public accountDataRes: ResourceRef<GetAccountResponse | null | undefined> = resource<
    GetAccountResponse | null,
    {
      accountName: string;
    }
  >({
    params: () => {
      return {
        accountName: this.accountName()
      };
    },
    loader: async (loaderParams: ResourceLoaderParams<{ accountName: string }>): Promise<GetAccountResponse | null> => {
      if (loaderParams.params) {
        const account = loaderParams.params.accountName;
        if (account) {
          const url = this.data.env.hyperionApiUrl + "/v2/state/get_account?account=" + account;
          return historyResponse(await lastValueFrom(this.httpClient.get<GetAccountResponse>(url)));
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
  });

  private accountResponse = computed(() => (this.accountDataRes.hasValue() ? this.accountDataRes.value() : undefined));
  private actionResponse = computed(() => (this.actionRes.hasValue() ? this.actionRes.value() : undefined));

  public firstGlobalSequence = computed<Sequence | null>(() => {
    const historical = this.accountResponse()?.actions[0]?.global_sequence;
    const applied = this.appliedStreamingActions()[0]?.global_sequence;
    if (!historical) return applied ?? null;
    return applied && compareSequences(applied, historical) > 0 ? applied : historical;
  });

  public totalActionCounter = computed(() => {
    if (this.filter()) {
      return this.actionResponse()?.total?.value ?? 0;
    } else {
      const historical = this.accountResponse()?.actions[0]?.global_sequence;
      const added = this.appliedStreamingActions().filter(
        action => !historical || compareSequences(action.global_sequence, historical) > 0
      ).length;
      const total = (this.accountResponse()?.total_actions ?? 0) + added;
      if (total > MAX_ES_SKIP) {
        return MAX_ES_SKIP;
      } else {
        return total;
      }
    }
  });

  // computed signals
  public tokensComputed = computed<TokenData[]>(() => {
    return this.accountResponse()?.tokens ?? [];
  });

  public accountComputed = computed<AccountData>(() => {
    return this.accountResponse()?.account ?? this.emptyAccount;
  });

  public hasContract = computed(() => {
    const account = this.accountResponse()?.account;
    if (account) {
      const last_code_update = account.last_code_update;
      if (!last_code_update) {
        return false;
      }
      const time = new Date(last_code_update + "Z").getTime();
      return time > 0;
    } else {
      return false;
    }
  });

  public actionsComputed = linkedSignal<any, HistoryAction[]>({
    source: () => {
      return {
        accountName: this.accountName(),
        accountActions: this.accountResponse()?.actions ?? [],
        filteredActions: this.actionResponse()?.actions ?? [],
        streamingActions: this.appliedStreamingActions(),
        activeFilter: this.filter(),
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        sortDirection: this.sortDirection()
      };
    },
    computation: (source, previous) => {
      const latestPage = !source.activeFilter && source.pageIndex === 0 && source.sortDirection !== "asc";
      // if we are on filtered action or on a different page, replace the filtered actions with the account actions
      if (
        source.filteredActions &&
        (source.activeFilter || source.pageIndex > 0 || source.sortDirection === "asc" || source.pageSize !== 20)
      ) {
        if (source.filteredActions.length > 0 || (latestPage && source.streamingActions.length)) {
          return latestPage
            ? mergeHistory(source.streamingActions, source.filteredActions).slice(0, source.pageSize)
            : source.filteredActions;
        } else {
          if (this.actionRes.hasValue()) {
            return [];
          } else {
            return previous && previous.source.accountName === source.accountName ? previous.value : [];
          }
        }
      } else {
        if (source.accountActions.length > 0 || source.streamingActions.length > 0) {
          return mergeHistory(source.streamingActions, source.accountActions).slice(0, source.pageSize);
        } else {
          if (source.activeFilter) {
            return previous && previous.source.accountName === source.accountName ? previous.value : [];
          } else {
            return [];
          }
        }
      }
    }
  });

  public userResPct = computed(() => {
    const account = this.accountComputed();
    const cpu = account.cpu_limit;
    const net = account.net_limit;
    const ramQuota = account.ram_quota;
    const ramUsage = account.ram_usage;
    return {
      cpu: cpu.max > 0 ? Math.min(100, Math.max(0, (cpu.used / cpu.max) * 100)) : 0,
      net: net.max > 0 ? Math.min(100, Math.max(0, (net.used / net.max) * 100)) : 0,
      ram: ramQuota > 0 ? Math.min(100, Math.max(0, (ramUsage / ramQuota) * 100)) : 0,
      cpuStr: cpu.max === -1 ? "Unlimited" : `${convertMicroS(cpu.used)} / ${convertMicroS(cpu.max)}`,
      netStr: net.max === -1 ? "Unlimited" : `${formatBytes(net.used)} / ${formatBytes(net.max)}`,
      ramStr: ramQuota === -1 ? "Unlimited" : `${formatBytes(ramUsage)} / ${formatBytes(ramQuota)}`
    };
  });

  public myCpuBalance = computed(() => {
    const account = this.accountComputed();
    if (account.self_delegated_bandwidth && account.self_delegated_bandwidth.cpu_weight) {
      return parseFloat(account.self_delegated_bandwidth.cpu_weight.split(" ")[0]);
    }
    return 0;
  });

  public myNetBalance = computed(() => {
    const account = this.accountComputed();
    if (account.self_delegated_bandwidth && account.self_delegated_bandwidth.net_weight) {
      return parseFloat(account.self_delegated_bandwidth.net_weight.split(" ")[0]);
    }
    return 0;
  });

  public liquidBalance = computed(() => {
    const account = this.accountComputed();
    if (account.core_liquid_balance && account.core_liquid_balance.length > 0) {
      return parseFloat(account.core_liquid_balance.split(" ")[0]);
    }
    return 0;
  });

  public cpuBalance = computed(() => {
    const account = this.accountComputed();
    if (account.total_resources) {
      // console.log(account);
      if (account.total_resources.cpu_weight) {
        return parseFloat(account.total_resources.cpu_weight.split(" ")[0]);
      } else {
        return 0;
      }
    }
    return 0;
  });

  public netBalance = computed(() => {
    const account = this.accountComputed();
    if (account.total_resources) {
      if (account.total_resources.net_weight) {
        return parseFloat(account.total_resources.net_weight.split(" ")[0]);
      } else {
        return 0;
      }
    }
    return 0;
  });

  public totalBalance = computed(() => {
    return this.liquidBalance() + this.myCpuBalance() + this.myNetBalance();
  });

  public totalBalanceUSD = computed(() => {
    return this.totalBalance() * this.chain.priceRateUsd();
  });

  public myStakedBalance = computed(() => {
    return this.myCpuBalance() + this.myNetBalance();
  });

  public cpuByOthers = computed(() => {
    return this.cpuBalance() - this.myCpuBalance();
  });

  public netByOthers = computed(() => {
    return this.netBalance() - this.myNetBalance();
  });

  public stakedByOthers = computed(() => {
    return this.cpuBalance() + this.netBalance() - (this.myCpuBalance() + this.myNetBalance());
  });

  systemSymbol = computed(() => {
    const account = this.accountComputed();
    const ramMarketSymbol = this.chain.systemSymbol.value();
    let symbol: string | null;
    if (account.core_liquid_balance) {
      symbol = getSymbol(this.accountComputed().core_liquid_balance);
    } else if (account.total_resources && account.total_resources.cpu_weight) {
      symbol = getSymbol(account.total_resources.cpu_weight);
    } else {
      symbol = ramMarketSymbol ?? "SYS";
    }
    return symbol;
  });

  systemPrecision = computed(() => {
    return getPrecision(this.accountComputed().core_liquid_balance);
  });

  refundBalance = computed(() => {
    let cpuRefund = 0;
    let netRefund = 0;
    const account = this.accountComputed();
    if (account.refund_request) {
      cpuRefund = parseFloat(account.refund_request.cpu_amount.split(" ")[0]);
      netRefund = parseFloat(account.refund_request.net_amount.split(" ")[0]);
    }
    return cpuRefund + netRefund;
  });
  private platformId = inject(PLATFORM_ID);
  private streamingActions = linkedSignal<string, HistoryAction[]>({ source: this.accountName, computation: () => [] });
  private appliedStreamingActions = linkedSignal<string, HistoryAction[]>({ source: this.accountName, computation: () => [] });
  private streamStartRevision = 0;
  public pendingStreamCount = computed(() => {
    const visible = new Set(this.actionsComputed().map(action => this.streamIdentity(action)));
    return this.streamingActions().filter(action => !visible.has(this.streamIdentity(action))).length;
  });
  private streamIdentity(action: HistoryAction): string {
    return JSON.stringify([action.global_sequence, action.trx_id, action.receiver, action.recv_sequence]);
  }
  showNewActions(): void {
    this.clearFilter();
    this.pageIndex.set(0);
    this.sortDirection.set("desc");
    this.appliedStreamingActions.set(this.streamingActions());
  }
  stopActionStream(): void {
    ++this.streamStartRevision;
    this.actionStream?.stop();
    this.actionStream = undefined;
    this.streamClientStatus.set(false);
    this.streamConnecting.set(false);
  }

  // Computed signal to expose the size of streamingActions
  public streamingActionsSize = computed(() => {
    return this.streamingActions().length;
  });
  private actionStream?: HyperionStream<ActionContent>;

  constructor() {
    effect(onCleanup => {
      if (!isPlatformBrowser(this.platformId) || !this.pendingActions().length || this.streamClientStatus()) return;
      const timer = setInterval(() => this.chain.chainInfoResource.reload(), 10000);
      onCleanup(() => clearInterval(timer));
    });
    // The published client exposes `online` but has no disconnect event.
    effect(onCleanup => {
      if (!isPlatformBrowser(this.platformId) || (!this.streamClientStatus() && !this.streamConnecting())) return;
      const timer = setInterval(() => this.streamOnline.set(this.streamClient?.online === true), 250);
      onCleanup(() => clearInterval(timer));
    });

    this.tableDataSource = toObservable(this.actionsComputed);

    if (isPlatformBrowser(this.platformId)) {
      const localSavedFilters = localStorage.getItem("userSavedFilters");
      if (localSavedFilters) {
        try {
          this.userSavedFilters = JSON.parse(localSavedFilters);
          if (this.userSavedFilters && this.userSavedFilters.length) {
            this.userSavedFilters.forEach(value => {
              const filterSpec: ActionFilterSpec = {
                name: (value.contract || "*") + "::" + (value.action || "*"),
                icon: faFilter,
                userFilter: true,
                exec: params => {
                  const conf = {} as Record<string, string>;
                  if (value.contract) {
                    conf["act.account"] = value.contract;
                  }
                  if (value.action) {
                    conf["act.name"] = value.action;
                  }
                  params.set(conf);
                }
              };
              this.commonFilters.push(filterSpec);
            });
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
  }

  pendingActions = computed(() => {
    // Use the new computed signal for LIB
    const lib = this.chain.lastIrreversibleBlockNum();
    if (lib) {
      return this.actionsComputed().filter(action => action.block_num > lib);
    } else {
      return [];
    }
  });

  async loadMoreActions(): Promise<void> {
    if (this.loadingMoreActions()) return;
    const lastAction = this.actionsComputed().at(-1);
    if (!lastAction) return;
    const sort = this.sortDirection() || "desc";
    const anchor = this.firstGlobalSequence();
    const boundary = sort === "asc" ? nextSequence(lastAction.global_sequence) : previousSequence(lastAction.global_sequence);
    if (boundary === null || (sort === "asc" && (anchor === null || compareSequences(boundary, anchor) > 0))) return;
    const context = this.historyContext();
    this.loadingMoreActions.set(true);
    this.historyError.set(null);
    try {
      const query = new URLSearchParams({
        ...this.customParams(),
        account: this.accountName(),
        sort,
        limit: "50",
        global_sequence: sort === "asc" ? `${boundary}-${anchor}` : `0-${boundary}`
      });
      const response = await lastValueFrom(
        this.httpClient.get<GetActionsResponse>(`${this.data.env.hyperionApiUrl}/v2/history/get_actions?${query}`)
      );
      if (context === this.historyContext()) {
        const results = historyResponse(response);
        this.actionsComputed.update(actions => {
          const merged = mergeHistory(actions, results.actions);
          return sort === "asc" ? merged.reverse() : merged;
        });
      }
    } catch (e) {
      if (context === this.historyContext()) this.historyError.set(describeApiError(e));
    } finally {
      this.loadingMoreActions.set(false);
    }
  }

  private historyContext(): string {
    return JSON.stringify([
      this.accountName(),
      this.customParams(),
      this.pageIndex(),
      this.pageSize(),
      this.sortDirection(),
      this.firstGlobalSequence()
    ]);
  }

  retryHistory(): void {
    this.historyError.set(null);
    this.accountDataRes.reload();
    this.actionRes.reload();
  }

  async loadTxData(txId: string): Promise<any> {
    this.loaded.set(false);
    this.requestError.set(null);
    try {
      const url = this.data.env.hyperionApiUrl + "/v2/history/get_transaction?id=" + txId;
      const data = historyResponse(await lastValueFrom(this.httpClient.get<{ actions: unknown[] }>(url)));
      this.loaded.set(true);
      return data;
    } catch (error) {
      this.requestError.set(describeApiError(error));
      this.loaded.set(true);
      return null;
    }
  }

  async loadBlockData(blockNum: number): Promise<any> {
    this.loaded.set(false);
    try {
      const url = this.data.env.hyperionApiUrl + "/v1/trace_api/get_block";
      const data = await lastValueFrom(this.httpClient.post(url, { block_num: blockNum }));
      this.loaded.set(true);
      return data;
    } catch (error) {
      console.log(error);
      this.loaded.set(true);
      return null;
    }
  }

  async loadPubKey(key: string): Promise<any> {
    console.log("Loading key data for: " + key);
    this.loaded.set(false);
    this.requestError.set(null);
    try {
      const url = this.data.env.hyperionApiUrl + "/v2/state/get_key_accounts?public_key=" + encodeURIComponent(key) + "&details=true";
      const data = await lastValueFrom(this.httpClient.get(url));
      this.loaded.set(true);
      return data;
    } catch (error) {
      this.requestError.set(describeApiError(error));
      this.loaded.set(true);
      return null;
    }
  }

  async getCreator(accountName: string): Promise<AccountCreationData | null> {
    try {
      const url = this.data.env.hyperionApiUrl + "/v2/history/get_creator?account=" + accountName;
      return (await lastValueFrom(this.httpClient.get(url))) as AccountCreationData;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async toggleStreaming(): Promise<void> {
    if (this.streamConnecting()) return;
    if (this.streamClientStatus()) {
      this.stopActionStream();
      return;
    }
    this.pageIndex.set(0);
    this.clearFilter();
    this.sortDirection.set("desc");
    const revision = this.streamStartRevision + 1;
    try {
      const active = await this.startActionStream();
      if (revision === this.streamStartRevision) this.streamClientStatus.set(active);
    } catch (error) {
      if (revision !== this.streamStartRevision) return;
      this.historyError.set(describeApiError(error));
      this.streamClientStatus.set(false);
    }
  }

  setFilter(filter: ActionFilterSpec): void {
    this.filter.set(filter);
    filter?.exec(this.customParams);
  }

  // save user created filter on local storage
  saveFilter(contract: string, action: string) {
    if (isPlatformBrowser(this.platformId)) {
      const filter = { contract, action };

      // check if filter already exists by name
      if (
        this.userSavedFilters.find(value => {
          return value.contract + "::" + value.action === filter.contract + "::" + filter.action;
        })
      ) {
        return;
      }

      this.userSavedFilters.push(filter);
      localStorage.setItem("userSavedFilters", JSON.stringify(this.userSavedFilters));
    }
  }

  clearFilter() {
    this.filter.set(null);
    this.customParams.set(undefined);
  }

  removeFilter(filter: ActionFilterSpec) {
    if (isPlatformBrowser(this.platformId)) {
      this.userSavedFilters = this.userSavedFilters.filter(value => {
        return value.contract + "::" + value.action !== filter.name;
      });
      localStorage.setItem("userSavedFilters", JSON.stringify(this.userSavedFilters));
      this.commonFilters = this.commonFilters.filter(value => {
        return value.name !== filter.name;
      });
    }
  }

  async startActionStream(): Promise<boolean> {
    const revision = ++this.streamStartRevision;
    const requestedAccount = this.accountName();
    this.streamConnecting.set(true);
    this.historyError.set(null);
    try {
      if (!this.streamClient) {
        this.streamClient = new HyperionStreamClient({
          endpoint: this.data.env.streamApiUrl || this.data.env.hyperionApiUrl,
          libMonitor: true,
          debug: false
        });
        this.streamClient.on("libUpdate", data => this.chain.streamLib.set(data.block_num));
        this.streamClient.on("connect", () => this.streamOnline.set(true));
      }
      if (!this.streamClient.online) await this.streamClient.connect();
      this.streamOnline.set(this.streamClient.online);
      if (revision !== this.streamStartRevision || requestedAccount !== this.accountName() || !this.streamClient.online) return false;
      const lastReceivedBlock = this.actionsComputed()[0]?.block_num || 0;
      const requestedStream = await this.streamClient.streamActions({
        account: requestedAccount,
        filters: [],
        read_until: 0,
        start_from: lastReceivedBlock + 1
      });
      if (revision !== this.streamStartRevision || requestedAccount !== this.accountName()) {
        requestedStream.stop();
        return false;
      }
      this.actionStream = requestedStream;
      const fail = (error: unknown) => {
        if (this.actionStream !== requestedStream || requestedAccount !== this.accountName()) return;
        this.stopActionStream();
        this.historyError.set(describeApiError(error));
      };
      requestedStream.on("error", fail);
      requestedStream.on("message", data => {
        if (this.actionStream !== requestedStream || requestedAccount !== this.accountName()) return;
        try {
          const action = historyAction(data.content);
          this.streamingActions.update(value => mergeHistory([action], value).slice(0, 500));
          this.lastStreamActionAt.set(Date.now());
        } catch (error) {
          fail(error);
        }
      });
      return true;
    } finally {
      if (revision === this.streamStartRevision) this.streamConnecting.set(false);
    }
  }
}
