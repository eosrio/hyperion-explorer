import {Routes} from '@angular/router';
import {AccountComponent} from "./components/search-results/account/account.component";
import {TransactionComponent} from "./components/search-results/transaction/transaction.component";
import {BlockComponent} from "./components/search-results/block/block.component";
import {KeyComponent} from "./components/search-results/key/key.component";
import {RenderMode, ServerRoute} from "@angular/ssr";
import {MainSearchComponent} from "./pages/main-search/main-search.component";
import {ContractComponent} from "./pages/contract/contract.component";
import {ErrorComponent} from "./pages/error/error.component";
import {accountNameGuard} from "./guards/account-name.guard";

export const routes: Routes = [
  {
    path: '',
    component: MainSearchComponent,
    children: [
      {
        path: 'account',
        children: [
          {path: '', redirectTo: '/', pathMatch: 'full'},
          {path: ':account_name', component: AccountComponent, canActivate: [accountNameGuard]},
        ]
      },
      {
        path: 'block',
        children: [
          {path: '', redirectTo: '/', pathMatch: 'full'},
          {path: ':block_num_or_id', component: BlockComponent}
        ]
      },
      {
        path: 'key/:pub_key',
        component: KeyComponent
      },
      {
        path: 'transaction/:transaction_id',
        component: TransactionComponent
      },
    ]
  },
  {
    path: 'contract/:code/:table/:scope',
    component: ContractComponent,
  },
  {
    path: 'contract/:code/:table',
    component: ContractComponent
  },
  {
    path: 'contract/:code',
    component: ContractComponent,
  },
  {
    path: 'error',
    component: ErrorComponent
  },
  {
    path: '**',
    component: MainSearchComponent
  }
];

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server
  },
  {
    path: 'account/:account_name',
    renderMode: RenderMode.Server
  },
  {
    path: 'contract/:code/:table/:scope',
    renderMode: RenderMode.Server
  },
  {
    path: 'contract/:code/:table',
    renderMode: RenderMode.Server
  },
  {
    path: 'contract/:code',
    renderMode: RenderMode.Server
  },
  {
    path: 'error',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
