import {Routes} from '@angular/router';
import {HomeComponent} from "./pages/home/home.component";
import {AccountComponent} from "./components/search-results/account/account.component";
import {TransactionComponent} from "./components/search-results/transaction/transaction.component";
import {ContractExplorerComponent} from "./components/contract-explorer/contract-explorer.component";

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    children: [
      {
        path: 'account/:account_name',
        component: AccountComponent
      },
      {
        path: 'transaction/:transaction_id',
        component: TransactionComponent
      },
    ]
  },
  {
    path: 'contract/:code/:table/:scope',
    component: ContractExplorerComponent
  },
  {
    path: 'contract/:code/:table',
    component: ContractExplorerComponent
  },
  {
    path: 'contract/:code',
    component: ContractExplorerComponent
  },
  {
    path: '**', component: HomeComponent
  }
];
