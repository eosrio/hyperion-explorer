import {Routes} from '@angular/router';
import {HomeComponent} from "./pages/home/home.component";
import {AccountComponent} from "./components/search-results/account/account.component";
import {TransactionComponent} from "./components/search-results/transaction/transaction.component";
import {ContractExplorerComponent} from "./components/contract-explorer/contract-explorer.component";
import {BlockComponent} from "./components/search-results/block/block.component";
import {KeyComponent} from "./components/search-results/key/key.component";
import {TestComponent} from "./pages/test/test.component";
import {RenderMode, ServerRoute} from "@angular/ssr";
import {LayoutAnimationTestComponent} from "./pages/layout-animation-test/layout-animation-test.component";

export const routes: Routes = [
  {
    path: '',
    component: LayoutAnimationTestComponent,
    children: [
      {
        path: 'account/:account_name',
        component: AccountComponent,
      },
      {path: 'block/:block_num_or_id', component: BlockComponent},
      {path: 'key/:pub_key', component: KeyComponent},
      {path: 'transaction/:transaction_id', component: TransactionComponent},
    ]
  },
  {
    path: 'test',
    component: TestComponent
  },
  {
    path: 'layout_test',
    component: HomeComponent
  },
  {
    path: 'contract/:account_name/:table/:scope',
    component: ContractExplorerComponent,
  },
  {
    path: 'contract/:account_name/:table',
    component: ContractExplorerComponent
  },
  {
    path: 'contract/:account_name',
    component: ContractExplorerComponent,
  },
  {
    path: '**', component: HomeComponent
  }
];

export const serverRoutes: ServerRoute[] = [
  {
    path: 'contract/:account_name/:table/:scope',
    renderMode: RenderMode.Server
  },
  {
    path: 'contract/:account_name/:table',
    renderMode: RenderMode.Server
  },
  {
    path: 'contract/:account_name',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
