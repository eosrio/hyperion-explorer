import {Injectable, signal} from '@angular/core';
import {environment} from "../../env";
import {HttpClient} from "@angular/common/http";
import {lastValueFrom} from "rxjs";
import {GetTableByScopeResponse, TableData} from "../interfaces";
import {DataService} from "./data.service";

@Injectable({providedIn: 'root'})
export class SearchService {

  searchType = signal<string>("");
  searchQuery = signal<string>("");

  searchAccountUrl: string;
  wildcardAccountUrl: string;

  autoCompleteCache: Map<string, string[]> = new Map();

  constructor(private http: HttpClient, private data: DataService) {
    this.searchAccountUrl = environment.hyperionApiUrl + '/v1/chain/get_table_by_scope';
    this.wildcardAccountUrl = environment.hyperionApiUrl + '/v2/state/get_voter_scopes';
  }

  async filterAccountNames(value: string): Promise<any> {

    // check local cache map
    if (this.autoCompleteCache.has(value)) {
      return this.autoCompleteCache.get(value);
    }

    if ((value && value.length > 12) || !value) {
      return [];
    }

    let result = [];

    try {
      const sValue = value.toLowerCase();
      const requestBody = {
        code: environment.systemContract,
        table: environment.userResourcesTable,
        lower_bound: sValue,
        limit: 100
      };

      const response = await lastValueFrom(this.http.post(this.searchAccountUrl, requestBody)) as GetTableByScopeResponse;

      if (response.rows && response.rows.length > 0) {

        const startsWithResult = response.rows
          .filter((tableData: TableData) => tableData.scope.startsWith(sValue))
          .map((tableData: TableData) => tableData.scope);

        if (startsWithResult.length === 0) {
          const wildcardResult = await lastValueFrom(this.http.get(this.wildcardAccountUrl + `?term=${sValue}`)) as any;
          if (wildcardResult && wildcardResult.scopes) {
            result = wildcardResult.scopes;
          } else {
            result = startsWithResult;
          }
        } else {
          result = startsWithResult;
        }
      }
    } catch (error) {
      console.log(error);
    }

    this.autoCompleteCache.set(value, result);

    return result;
  }


  submitSearch(searchText: any, filteredAccounts: string[]): boolean {

    const sValue = searchText.toLowerCase();
    this.searchQuery.set(sValue);

    // account direct
    if (filteredAccounts.length > 0) {
      this.searchType.set("account");
      return true;
    }

    // tx id
    if (sValue.length === 64) {

      // check if the first 8 bytes represent a number
      const blockNumCandidate = parseInt(sValue.substring(0, 8), 16);
      const isNumber = !isNaN(blockNumCandidate);

      if (isNumber && this.data.explorerMetadata && this.data.explorerMetadata.last_indexed_block >= blockNumCandidate) {

        if (blockNumCandidate === 0) {
          return false;
        }

        this.searchQuery.set(blockNumCandidate.toString(10));
        this.searchType.set("block");
      } else {
        this.searchType.set("transaction");
      }

      return true;
    }

    // account search
    if (sValue.length > 0 && sValue.length <= 12 && isNaN(sValue)) {
      this.searchType.set("account");
      return true;
    }

    // public key
    if (searchText.startsWith('PUB_') || searchText.startsWith('EOS')) {
      this.searchType.set("key");
      this.searchQuery.set(searchText);
      return true;
    }

    // block number
    const blockNum = searchText.replace(/[,.]/g, '');
    if (parseInt(blockNum, 10) > 0) {
      this.searchType.set("block");
      return true;
    }

    // match EVM 0x prefix
    if (searchText.startsWith('0x')) {
      let route;
      switch (searchText.length) {
        case 42: {
          route = '/evm/address';
          this.searchType.set("evm/address");
          break;
        }
        case 66: {
          route = '/evm/transaction';
          this.searchType.set("evm/transaction");
          break;
        }
        default: {
          if (searchText.length < 16) {
            // probably a block number in hex
            route = '/evm/block';
            this.searchType.set("evm/block");
          } else {
            console.log('Ox prefixed string with length:', searchText.length);
          }
        }
      }
      if (route) {
        return true;
      }
    }

    console.log('NO PATTERN MATCHED!');
    this.searchType.set("__invalid");
    return false;
  }
}
