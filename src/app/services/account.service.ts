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
import { convertMicroS, getPrecision, getSymbol } from "../utils";
import { faComputer, faFilter, faMoneyBill, faRightFromBracket, faRightToBracket, faVoteYea } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/angular-fontawesome";
import { isPlatformBrowser } from "@angular/common";
import { SortDirection } from "@angular/material/sort";
import { ChainService } from "./chain.service";
import { devEnv } from "../dev.env";

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

  actions: any[] = [];
  public tableDataSource: Observable<any[]>;
  streamClient?: HyperionStreamClient;
  public streamClientStatus = signal(false);
  public libNum = signal<number>(0);
  private pendingSet = new Set<number>();
  public streamClientLoaded = false;

  // signals
  public loaded = signal(false);
  public accountName = signal("");
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
    {
      accountName: string;
      customParams?: Record<string, string>;
      limit: number;
      skip: number;
      first: number;
      sort: string;
    }
  >({
    params: () => {
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
      let firstGS = params.first;

      // stop streaming if enabled
      if (this.streamClientStatus() && this.streamClient?.online && this.actionStream) {
        console.log("Stopping Stream Client");
        this.actionStream.stop();
        this.streamingActions.set([]);
        this.streamClientStatus.set(false);
      }

      const cp = params.customParams;
      const { limit, skip, sort } = params;
      if (cp || skip > 0 || sort === "asc") {
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
          const res = (await lastValueFrom(this.httpClient.get(url))) as GetActionsResponse;
          console.log("Query Time", res.query_time_ms);
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
          return (await lastValueFrom(this.httpClient.get(url))) as GetAccountResponse;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
  });

  public firstGlobalSequence = computed<number>(() => {
    return this.accountDataRes.value()?.actions[0]?.global_sequence ?? 0;
  });

  public totalActionCounter = computed(() => {
    if (this.filter()) {
      return this.actionRes.value()?.total.value ?? 0;
    } else {
      const total = this.accountDataRes.value()?.total_actions ?? 0;
      if (total > MAX_ES_SKIP) {
        return MAX_ES_SKIP;
      } else {
        return total;
      }
    }
  });

  // computed signals
  public tokensComputed = computed<TokenData[]>(() => {
    return this.accountDataRes.value()?.tokens ?? [];
  });

  public accountComputed = computed<AccountData>(() => {
    return this.accountDataRes.value()?.account ?? this.emptyAccount;
  });

  public hasContract = computed(() => {
    const account = this.accountDataRes.value()?.account;
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

  public actionsComputed = linkedSignal<any, any[]>({
    source: () => {
      return {
        accountActions: this.accountDataRes.value()?.actions ?? [],
        filteredActions: this.actionRes.value()?.actions ?? [],
        streamingActions: this.streamingActions() ?? [],
        activeFilter: this.filter(),
        pageIndex: this.pageIndex(),
        sortDirection: this.sortDirection()
      };
    },
    computation: (source, previous) => {
      // if we are on filtered action or on a different page, replace the filtered actions with the account actions
      if (source.filteredActions && (source.activeFilter || source.pageIndex > 0 || source.sortDirection === "asc")) {
        if (source.filteredActions.length > 0) {
          return source.filteredActions;
        } else {
          if (this.actionRes.hasValue()) {
            return [];
          } else {
            return previous?.value ?? [];
          }
        }
      } else {
        if (source.accountActions.length > 0) {
          return [...source.streamingActions, ...source.accountActions].slice(0, 20);
        } else {
          if (source.activeFilter) {
            return previous?.value ?? [];
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
      cpu: cpu.max === -1 ? 0 : (cpu.used / cpu.max) * 100,
      net: net.max === -1 ? 0 : (net.used / net.max) * 100,
      ram: ramQuota === -1 ? 0 : (ramUsage / ramQuota) * 100,
      cpuStr: cpu.max === -1 ? "♾️" : `${convertMicroS(cpu.used)} / ${convertMicroS(cpu.max)}`,
      netStr: net.max === -1 ? "♾️" : `${convertMicroS(net.used)} / ${convertMicroS(net.max)}`,
      ramStr: ramQuota === -1 ? "♾️" : `${ramUsage} / ${ramQuota}`
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
      console.log(account);
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
  private streamingActions = signal<any[]>([]);

  // Computed signal to expose the size of streamingActions
  public streamingActionsSize = computed(() => {
    return this.streamingActions().length;
  });
  private actionStream?: HyperionStream<ActionContent>;

  constructor() {
    // monitor pending actions for LIB check
    effect(() => {
      const pendingActions = this.pendingActions();
      const isStreaming = this.streamClientStatus();
      // Use the new computed signal for LIB
      console.log(`Pending Actions (lib: ${this.chain.lastIrreversibleBlockNum()})`, pendingActions.length);
      if (pendingActions.length > 0 && !isStreaming) {
        untracked(() => {
          setTimeout(() => {
            console.log(`Rechecking Chain Info (for LIB)...`);
            // Use the new resource for chain info
            const reloadStatus = this.chain.chainInfoResource.reload();
            console.log(`Reload status: ${reloadStatus}`);
          }, 10000);
        });
      }
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
    const accountName = this.accountName();
    const firstAction = this.actions[this.actions.length - 1];
    const maxGs = firstAction.global_sequence - 1;
    try {
      const q = `${this.data.env.hyperionApiUrl}/v2/history/get_actions?account=${accountName}&global_sequence=0-${maxGs}&limit=50`;
      const results = (await lastValueFrom(this.httpClient.get(q))) as any;
      if (results.actions && results.actions.length > 0) {
        this.actions.push(...results.actions);
        // this.tableDataSource.data = this.actions;
      }
    } catch (e) {
      console.log(e);
    }
  }

  async loadTxData(txId: string): Promise<any> {
    this.loaded.set(false);
    try {
      const url = this.data.env.hyperionApiUrl + "/v2/history/get_transaction?id=" + txId;
      const data = await lastValueFrom(this.httpClient.get(url));
      this.loaded.set(true);
      return data;
    } catch (error) {
      console.log(error);
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
    try {
      const url = this.data.env.hyperionApiUrl + "/v2/state/get_key_accounts?public_key=" + key + "&details=true";
      const data = await lastValueFrom(this.httpClient.get(url));
      this.loaded.set(true);
      return data;
    } catch (error) {
      console.log(error);
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
    if (this.streamClientStatus()) {
      // Pause Streaming
      if (this.streamClient && this.actionStream) {
        this.actionStream.stop();
      }
      this.streamClientStatus.set(false);
    } else {
      // Start Streaming from the last received block
      this.pageIndex.set(0);
      await this.startActionStream();
      this.streamClientStatus.set(true);
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

  async startActionStream() {
    if (!this.streamClient) {
      this.streamClient = new HyperionStreamClient({
        endpoint: devEnv.streamApiUrl ?? this.data.env.hyperionApiUrl,
        libMonitor: true,
        debug: true
      });
      await this.streamClient.connect();
      this.streamClient.on("libUpdate", data => {
        this.chain.streamLib.set(data.block_num);
      });
      console.log("Connected to stream client");
    }

    if (this.streamClient && !this.streamClient.online) {
      await this.streamClient.connect();
      console.log("Reconnected to stream client");
    }

    if (this.streamClient && this.streamClient.online) {
      const lastReceivedBlock = this.actionsComputed().length > 0 ? this.actionsComputed()[0].block_num : 0;

      console.log(`Last received block: ${lastReceivedBlock}`);

      this.actionStream = await this.streamClient.streamActions({
        account: this.accountName(),
        filters: [],
        read_until: 0,
        start_from: lastReceivedBlock + 1
      });

      console.log(
        `Streaming actions from block ${lastReceivedBlock + 1} for account ${this.accountName()}, hash: ${this.actionStream.requestHash}`
      );

      this.actionStream.on("message", (data: any) => {
        const action = data.content;
        this.streamingActions.update(value => {
          // Add the new action to the beginning of the array and limit to 500 items
          return [action, ...value].slice(0, 500);
        });
      });
    }
  }
}
