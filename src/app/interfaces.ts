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
  cpu_limit: {
    used: number;
    max: number;
  },
  net_limit: {
    used: number;
    max: number;
  },
  self_delegated_bandwidth: {
    cpu_weight: string;
    net_weight: string;
  },
  total_resources: {
    cpu_weight: string;
    net_weight: string;
  }
}

export interface GetAccountResponse {
  account: AccountData;
  actions: any[];
  tokens: any[];
  links: any[];
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
