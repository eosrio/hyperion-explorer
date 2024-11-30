import {
  computed,
  effect,
  inject,
  Injectable, linkedSignal, PLATFORM_ID,
  resource,
  ResourceLoaderParams,
  ResourceRef,
  signal,
  WritableSignal
} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AccountCreationData, AccountData, GetAccountResponse, GetActionsResponse, TokenData} from '../interfaces';
// import {HyperionStreamClient} from '@eosrio/hyperion-stream-client';
import {PaginationService} from "./pagination.service";
import {lastValueFrom, Observable, of} from "rxjs";
import {DataService} from "./data.service";
import {rxResource, toObservable} from "@angular/core/rxjs-interop";
import {convertMicroS, getPrecision, getSymbol} from "../utils";
import {faFilter, faRightFromBracket, faRightToBracket, faVoteYea} from "@fortawesome/free-solid-svg-icons";
import {IconDefinition} from "@fortawesome/angular-fontawesome";
import {isPlatformBrowser} from "@angular/common";

interface HealthResponse {
  features: {
    streaming: {
      deltas: boolean;
      enable: boolean;
      traces: boolean;
    }
  };
}

export interface ActionFilterSpec {
  name: string;
  icon?: IconDefinition,
  userFilter?: boolean;
  exec: (params: WritableSignal<Record<string, string> | undefined>) => void;
}

@Injectable({providedIn: 'root'})
export class AccountService {

  private data = inject(DataService);
  private httpClient = inject(HttpClient);
  private pagService = inject(PaginationService);

  emptyAccount: AccountData & any = {
    cpu_limit: {used: 1, max: 1},
    net_limit: {used: 1, max: 1}
  };

  actions: any[] = [];
  public tableDataSource: Observable<any[]>;
  // streamClient?: HyperionStreamClient;
  public streamClientStatus = false;
  public libNum = signal<number>(0);
  private verificationLoop: any;
  private predictionLoop: any;
  private pendingSet = new Set<number>();
  public streamClientLoaded = false;

  // signals
  public loaded = signal(false);
  public accountName = signal("");
  public customParams = signal<Record<string, string> | undefined>(undefined);

  filter = signal<ActionFilterSpec | null>(null);

  commonFilters: ActionFilterSpec[] = [
    // received transfers
    {
      name: 'Incoming Transfers',
      icon: faRightToBracket,
      exec: (params) => {
        params.set({
          '@transfer.to': this.accountName()
        });
      }
    },
    // sent transfers
    {
      name: 'Outgoing Transfers',
      icon: faRightFromBracket,
      exec: (params) => {
        params.set({
          '@transfer.from': this.accountName()
        });
      }
    },
    // votes
    {
      name: 'Votes',
      icon: faVoteYea,
      exec: (params) => {
        params.set({
          'account': this.accountName(),
          'act.account': "eosio",
          'act.name': "voteproducer",
        });
      }
    }
  ];

  userSavedFilters: any[] = [];

  accountActions: any[] = [];

  // actions Resource
  public actionRes = rxResource<GetActionsResponse, {
    accountName: string,
    customParams?: Record<string, string>
  }>({
    request: () => {
      return {
        accountName: this.accountName(),
        customParams: this.customParams()
      };
    },
    loader: (param) => {
      const cp = param.request.customParams;
      if (cp) {
        const query = new URLSearchParams();
        for (const key in cp) {
          if (cp.hasOwnProperty(key)) {
            // console.log(`Setting ${key} to ${cp[key]}`);
            query.set(key, cp[key]);
          }
        }
        const url = this.data.env.hyperionApiUrl + '/v2/history/get_actions?' + query.toString();
        return this.httpClient.get(url) as Observable<GetActionsResponse>;
      } else {
        return of({actions: []} as unknown as GetActionsResponse);
      }
    }
  });

  // accountData Resource
  public accountDataRes: ResourceRef<GetAccountResponse | null> = resource<GetAccountResponse | null, {
    accountName: string,
  }>({
    request: () => {
      return {
        accountName: this.accountName(),
      }
    },
    loader: async (param: ResourceLoaderParams<{ accountName: string }>): Promise<GetAccountResponse | null> => {
      if (param.request) {
        const account = param.request.accountName;
        if (account) {
          const url = this.data.env.hyperionApiUrl + '/v2/state/get_account?account=' + account;
          return await lastValueFrom(this.httpClient.get(url)) as GetAccountResponse;
        } else {
          return null;
        }
      } else {
        return null;
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
        activeFilter: this.filter()
      };
    },
    computation: (source, previous) => {
      if (source.filteredActions && source.activeFilter) {
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
          return source.accountActions;
        } else {
          return previous?.value ?? [];
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
    if (account.self_delegated_bandwidth) {
      return parseFloat(account.self_delegated_bandwidth.cpu_weight.split(' ')[0]);
    }
    return 0;
  });

  public myNetBalance = computed(() => {
    const account = this.accountComputed();
    if (account.self_delegated_bandwidth) {
      return parseFloat(account.self_delegated_bandwidth.net_weight.split(' ')[0]);
    }
    return 0;
  });

  public liquidBalance = computed(() => {
    const account = this.accountComputed();
    if (account.core_liquid_balance) {
      return parseFloat(account.core_liquid_balance.split(' ')[0]);
    }
    return 0;
  });

  public cpuBalance = computed(() => {
    const account = this.accountComputed();
    if (account.total_resources) {
      return parseFloat(account.total_resources.cpu_weight.split(' ')[0]);
    }
    return 0;
  });

  public netBalance = computed(() => {
    const account = this.accountComputed();
    if (account.total_resources) {
      return parseFloat(account.total_resources.net_weight.split(' ')[0]);
    }
    return 0;
  });

  public totalBalance = computed(() => {
    return this.liquidBalance() + this.myCpuBalance() + this.myNetBalance();
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
    return (this.cpuBalance() + this.netBalance()) - (this.myCpuBalance() + this.myNetBalance());
  });

  systemSymbol = computed(() => {
    const account = this.accountComputed();
    if (account.core_liquid_balance) {
      return getSymbol(this.accountComputed().core_liquid_balance) ?? "SYS";
    } else if (account.total_resources.cpu_weight) {
      return getSymbol(account.total_resources.cpu_weight) ?? "SYS";
    } else {
      return "SYS";
    }
  });

  systemPrecision = computed(() => {
    return getPrecision(this.accountComputed().core_liquid_balance);
  });

  refundBalance = computed(() => {
    let cpuRefund = 0;
    let netRefund = 0;
    const account = this.accountComputed();
    if (account.refund_request) {
      cpuRefund = parseFloat(account.refund_request.cpu_amount.split(' ')[0]);
      netRefund = parseFloat(account.refund_request.net_amount.split(' ')[0]);
    }
    return cpuRefund + netRefund;
  });
  private platformId = inject(PLATFORM_ID);

  constructor() {

    // console.log('AccountService created');

    effect(() => {
      console.log('Account resource loaded:', this.accountDataRes.value());
      // console.log(this.hasContract())
    });

    //
    // effect(() => {
    //   console.log('tokensComputed:', this.tokensComputed());
    // });
    //
    // effect(() => {
    //   console.log('accountComputed:', this.accountComputed());
    // });
    //

    // effect(() => {
    //   console.log('actions:', this.actionsComputed());
    // });

    const baseUrl = this.data.env.hyperionApiUrl;
    this.tableDataSource = toObservable(this.actionsComputed);
    // this.initStreamClient().catch(console.log);

    if (isPlatformBrowser(this.platformId)) {
      const localSavedFilters = localStorage.getItem('userSavedFilters');
      if (localSavedFilters) {
        try {
          this.userSavedFilters = JSON.parse(localSavedFilters);
          if (this.userSavedFilters && this.userSavedFilters.length) {
            this.userSavedFilters.forEach(value => {
              const filterSpec: ActionFilterSpec = {
                name: (value.contract || '*') + '::' + (value.action || '*'),
                icon: faFilter,
                userFilter: true,
                exec: params => {
                  const conf = {
                    'account': this.accountName()
                  } as Record<string, string>;
                  if (value.contract) {
                    conf['act.account'] = value.contract;
                  }
                  if (value.action) {
                    conf['act.name'] = value.action;
                  }
                  params.set(conf);
                }
              }
              this.commonFilters.push(filterSpec);
            });
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
  }

  async monitorLib(): Promise<void> {
    console.log('Starting LIB monitoring...');

    if (!this.verificationLoop) {
      this.verificationLoop = setInterval(async () => {
        await this.updateLib();
      }, 21 * 12 * 500);
    }

    if (!this.predictionLoop) {
      this.predictionLoop = setInterval(() => {

        this.libNum.update(value => {
          return (value ?? 0) + 12;
        });

        if (this.pendingSet.size > 0) {
          this.pendingSet.forEach(async (value) => {
            if (value < (this.libNum() ?? 0)) {
              console.log(`Block cleared ${value} < ${this.libNum()}`);
              this.pendingSet.delete(value);
            }
          });
        } else {
          console.log('No more pending actions, clearing loops');
          this.clearLoops();
        }
      }, 12 * 500);
    }

  }

  async checkIrreversibility(): Promise<void> {
    this.libNum.set(await this.checkLib() ?? 0);
    if (this.libNum()) {
      let counter = 0;
      for (const action of this.actions) {
        if (action.block_num <= this.libNum()) {
          action.irreversible = true;
        } else {
          counter++;
          this.pendingSet.add(action.block_num);
        }
      }
      if (counter > 0) {
        console.log('Pending actions: ' + counter);
        this.monitorLib().catch(console.log);
      }
    }
  }

  async updateLib(): Promise<void> {
    this.libNum.set(await this.checkLib() ?? 0);
  }

  async checkLib(): Promise<number | null> {
    try {
      const info = await lastValueFrom(this.httpClient.get(this.data.env.hyperionApiUrl + '/v1/chain/get_info')) as any;
      if (info) {
        return info.last_irreversible_block_num;
      } else {
        return null;
      }
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  // async initStreamClient(): Promise<void> {
  //   try {
  //     const health = await lastValueFrom(this.httpClient.get(this.server + '/v2/health')) as HealthResponse;
  //     if (health.features.streaming.enable) {
  //       this.streamClient = new HyperionStreamClient(this.server, {async: true});
  //       this.streamClient = new HyperionStreamClient({
  //           endpoint: this.server
  //       });
  //       this.streamClientLoaded = true;
  //       this.streamClient.onConnect = () => {
  //         this.streamClientStatus = this.streamClient.online;
  //       };
  //
  //       this.streamClient.onLIB = (data) => {
  //         this.libNum = data.block_num;
  //       };
  //
  //       this.streamClient.onData = async (data: IncomingData, ack) => {
  //         if (data.type === 'action') {
  //           this.actions.unshift(data.content);
  //           if (this.actions.length > 20) {
  //             this.actions.pop();
  //           }
  //           this.tableDataSource.data = this.actions;
  //         }
  //         ack();
  //       };
  //     } else {
  //       console.log('Streaming disabled!');
  //       this.streamClientLoaded = false;
  //     }
  //   } catch (e) {
  //     console.log(e);
  //   }
  // }

  // setupRequests(): void {
  //   // find latest block
  //   let maxBlock = 0;
  //   for (const action of this.actions) {
  //     if (action.block_num > maxBlock) {
  //       maxBlock = action.block_num;
  //     }
  //   }
  //
  //   console.log(maxBlock);
  //
  //   // setup request
  //   this.streamClient.onConnect = () => {
  //     this.streamClient.streamActions({
  //       account: this.account.account_name,
  //       action: '*',
  //       contract: '*',
  //       filters: [],
  //       read_until: 0,
  //       start_from: maxBlock + 1
  //     }).catch(console.log);
  //     this.streamClientStatus = this.streamClient.online;
  //   };
  // }

  // async loadAccountData(accountName: string): Promise<boolean> {
  //   this.loaded.set(false);
  //   if (accountName.length > 13) {
  //     console.error(`Account name (${accountName}) is invalid`);
  //     return false;
  //   }
  //   console.log('Loading account data for: ' + accountName);
  //   try {
  //     const url = this.data.env.hyperionApiUrl + '/v2/state/get_account?account=' + accountName;
  //     console.log(url);
  //     this.jsonData = await lastValueFrom(this.httpClient.get(url)) as GetAccountResponse;
  //
  //     if (this.jsonData.account) {
  //       this.account = this.jsonData.account;
  //     }
  //
  //     if (this.jsonData.actions) {
  //       this.actions = this.jsonData.actions;
  //       if (isPlatformBrowser(this.platformId)) {
  //         this.checkIrreversibility().catch(console.log);
  //       }
  //     }
  //
  //     if (this.jsonData.total_actions) {
  //       this.pagService.totalItems = this.jsonData.total_actions;
  //     }
  //
  //     this.loaded.set(true);
  //     return true;
  //   } catch (error: any) {
  //     console.log(error.message);
  //     this.jsonData = null;
  //     this.loaded.set(true);
  //     return false;
  //   }
  // }

  async loadMoreActions(): Promise<void> {
    const accountName = this.accountName();
    const firstAction = this.actions[this.actions.length - 1];
    const maxGs = (firstAction.global_sequence - 1);
    try {
      const q = `${this.data.env.hyperionApiUrl}/v2/history/get_actions?account=${accountName}&global_sequence=0-${maxGs}&limit=50`;
      const results = await lastValueFrom(this.httpClient.get(q)) as any;
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
      const url = this.data.env.hyperionApiUrl + '/v2/history/get_transaction?id=' + txId;
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
      const url = this.data.env.hyperionApiUrl + '/v1/trace_api/get_block';
      const data = await lastValueFrom(this.httpClient.post(url, {
        block_num: blockNum
      }));
      this.loaded.set(true);
      return data;
    } catch (error) {
      console.log(error);
      this.loaded.set(true);
      return null;
    }
  }

  async loadPubKey(key: string): Promise<any> {
    console.log('Loading key data for: ' + key);
    this.loaded.set(false);
    try {
      const url = this.data.env.hyperionApiUrl + '/v2/state/get_key_accounts?public_key=' + key + '&details=true';
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
      const url = this.data.env.hyperionApiUrl + '/v2/history/get_creator?account=' + accountName;
      return await lastValueFrom(this.httpClient.get(url)) as AccountCreationData;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  toggleStreaming(): void {
    // if (this.streamClientStatus) {
    //   this.streamClient.disconnect();
    //   this.streamClientStatus = false;
    //   this.checkIrreversibility().catch(console.log);
    // } else {
    //   this.tableDataSource.paginator.firstPage();
    //   this.clearLoops();
    //   this.setupRequests();
    //   this.streamClient.connect(() => {
    //     console.log('hyperion streaming client connected!');
    //   });
    // }
  }

  clearLoops(): void {
    if (this.predictionLoop) {
      clearInterval(this.predictionLoop);
    }
    if (this.verificationLoop) {
      clearInterval(this.verificationLoop);
    }
  }

  // disconnectStream(): void {
  //     if (this.streamClient && this.streamClientStatus) {
  //         this.streamClient.disconnect();
  //         this.streamClient.online = false;
  //         this.streamClientStatus = false;
  //     }
  // }

  setFilter(filter: ActionFilterSpec): void {
    this.filter.set(filter);
    filter?.exec(this.customParams);
  }

  // save user created filter on local storage
  saveFilter(contract: string, action: string) {
    if (isPlatformBrowser(this.platformId)) {
      const filter = {contract, action};

      // check if filter already exists by name
      if (this.userSavedFilters.find(value => {
        return (value.contract + '::' + value.action) === (filter.contract + '::' + filter.action);
      })) {
        return;
      }

      this.userSavedFilters.push(filter);
      localStorage.setItem('userSavedFilters', JSON.stringify(this.userSavedFilters));
    }
  }

  clearFilter() {
    this.filter.set(null);
    this.customParams.set(undefined);
  }

  removeFilter(filter: ActionFilterSpec) {
    if (isPlatformBrowser(this.platformId)) {
      this.userSavedFilters = this.userSavedFilters.filter(value => {
        return (value.contract + '::' + value.action) !== filter.name;
      });
      localStorage.setItem('userSavedFilters', JSON.stringify(this.userSavedFilters));
      this.commonFilters = this.commonFilters.filter(value => {
        return value.name !== filter.name;
      });
    }
  }
}
