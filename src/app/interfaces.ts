export interface ExplorerMetadata {
  logo: string;
  provider: string;
  provider_url: string;
  chain_name: string;
  chain_id: string;
  custom_core_token: string;
  query_time_ms: number;
  last_indexed_block: number;
  last_indexed_block_time: string;
  theme: Record<string, any>;
}

export interface TokenData {
  amount: number;
  contract: string;
  precision: number;
  symbol: string;
}

export interface AccountData {
  account_name: string;
  core_liquid_balance: string;
  permissions: Permission[],
  cpu_limit: {
    used: number;
    max: number;
  },
  net_limit: {
    used: number;
    max: number;
  },
  privileged: boolean;
  self_delegated_bandwidth: {
    cpu_weight: string;
    net_weight: string;
  },
  total_resources: {
    cpu_weight: string;
    net_weight: string;
  },
  refund_request: {
    cpu_amount: string;
    net_amount: string;
  },
  ram_quota: number;
  ram_usage: number;
  voter_info: {
    producers: string[];
    proxy: string;
  },
  last_code_update: string;
}

export interface GetAccountResponse {
  account: AccountData;
  actions: any[];
  tokens: any[];
  total_actions: number;
  links: any[];
}

export interface GetActionsResponse {
  actions: any[];
  lib: number;
  cached: boolean;
  last_indexed_block: number;
  last_indexed_block_time: string;
  query_time_ms: number;
  total: {
    value: number;
    relation: string;
  }
}

export interface GetDeltasResponse {
  deltas: {
    timestamp: string;
    present: number;
    code: string;
    scope: string;
    table: string;
    primary_key: string;
    payer: string;
    block_num: number;
    block_id: string;
    data: any;
  }[];
  cached: boolean;
  last_indexed_block: number;
  last_indexed_block_time: string;
  query_time_ms: number;
  total: {
    value: number;
    relation: string;
  }
}

export interface TableData {
  code: string;
  scope: string;
  table: string;
  payer: string;
  count: number;
}

export interface GetTableByScopeResponse {
  rows: TableData[];
  more: string;
}

export interface AccountCreationData {
  creator?: string;
  timestamp?: string;
}

export interface AbiTable {
  index_type: string;
  key_names: any[];
  key_types: any[];
  name: string;
  type: string;
}

export interface AbiStructField {
  name: string;
  type: string;
}

export interface GetAbiResponse {
  abi: {
    abi_extensions: any[];
    action_results: any[];
    actions: any[];
    error_messages: any[];
    ricardian_clauses: any[];
    structs: any[];
    tables: AbiTable[];
    types: any[];
    variants: any[];
    version: string;
  },
  account_name: string;
}

export interface ContractExplorerData {
  account: string;
  table: string;
  scope: string;
}

export interface Permission {
  expanded: boolean;
  perm_name: string;
  parent: string;
  required_auth: RequiredAuth;
  children?: Permission[];
}

export interface RequiredAuth {
  threshold: number;
  keys: Keys[];
  accounts?: Account[];
  waits?: Waits[];
}

export interface Keys {
  key: string;
  weight: number;
}

export interface Account {
  permission: Perm;
  weight: number;
}

export interface Perm {
  actor: string;
  permission: string;
}

export interface Waits {
  wait_sec: number;
  weight: number;
}

