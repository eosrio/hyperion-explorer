import {Routes} from '@angular/router';
import {RenderMode, ServerRoute} from "@angular/ssr";
import {accountNameGuard} from "./guards/account-name.guard";

async function loadMainSearchComponent() {
  let m = await import('./pages/main-search/main-search.component');
  return m.MainSearchComponent;
}

async function loadContractComponent() {
  let m = await import('./pages/contract/contract.component');
  return m.ContractComponent;
}

export const routes: Routes = [
  {
    path: '',
    loadComponent: loadMainSearchComponent,
    children: [
      {
        path: 'account',
        children: [
          {path: '', redirectTo: '/', pathMatch: 'full'},
          {
            path: ':account_name',
            canActivate: [accountNameGuard],
            loadComponent: async () => {
              let m = await import('./components/search-results/account/account.component');
              return m.AccountComponent;
            }
          },
        ]
      },
      {
        path: 'block',
        children: [
          {path: '', redirectTo: '/', pathMatch: 'full'},
          {
            path: ':block_num_or_id',
            loadComponent: async () => {
              let m = await import('./components/search-results/block/block.component');
              return m.BlockComponent;
            }
          }
        ]
      },
      {
        path: 'key',
        children: [
          {path: '', redirectTo: '/', pathMatch: 'full'},
          {
            path: ':pub_key',
            loadComponent: async () => {
              let m = await import('./components/search-results/key/key.component');
              return m.KeyComponent;
            }
          }
        ],

      },
      {
        path: 'transaction',
        children: [
          {path: '', redirectTo: '/', pathMatch: 'full'},
          {
            path: ':transaction_id',
            loadComponent: async () => {
              let m = await import('./components/search-results/transaction/transaction.component');
              return m.TransactionComponent;
            }
          }
        ]
      },
    ]
  },
  {
    path: 'contract',
    children: [
      {path: ':code/:table/:scope', loadComponent: loadContractComponent},
      {path: ':code/:table', loadComponent: loadContractComponent},
      {path: ':code', loadComponent: loadContractComponent},
    ],
  },
  {
    path: 'error',
    loadComponent: async () => {
      let m = await import('./pages/error/error.component');
      return m.ErrorComponent;
    }
  },
  {
    path: '**',
    loadComponent: loadMainSearchComponent
  }
];

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
