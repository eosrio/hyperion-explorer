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
}

export interface ExploreContractDialogData {
  code: string;
}

export interface GetAccountResponse {
  account: string;
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
  creator: string;
  timestamp: string;
}
