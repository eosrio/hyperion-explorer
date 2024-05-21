import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  constructor() { }

  async submitSearch(searchText: any, filteredAccounts: string[]): Promise<boolean> {
    console.log(searchText, filteredAccounts);
    return false;
  }
}
