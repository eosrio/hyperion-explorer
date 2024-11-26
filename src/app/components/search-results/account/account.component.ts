import {Component, ElementRef, inject, OnInit, PLATFORM_ID, signal, viewChild, WritableSignal} from '@angular/core';
import {SearchService} from "../../../services/search.service";
import {MatButton} from "@angular/material/button";
import {ActivatedRoute, Router, RouterLink} from "@angular/router";
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {MatCardContent, MatCardHeader} from "@angular/material/card";
import {FaIconComponent, FaLayersComponent} from "@fortawesome/angular-fontawesome";
import {MatProgressBar} from "@angular/material/progress-bar";
import {MatTooltip} from "@angular/material/tooltip";
import {DatePipe, DecimalPipe, isPlatformBrowser, NgClass} from "@angular/common";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {MatCell, MatColumnDef, MatHeaderCell, MatHeaderRow, MatRow, MatTableModule} from "@angular/material/table";
import {AccountService, ActionFilterSpec} from "../../../services/account.service";
import {faQuestionCircle} from "@fortawesome/free-regular-svg-icons";
import {
  faCheck,
  faChevronDown,
  faChevronRight,
  faCircle,
  faClock,
  faEllipsisV,
  faHistory,
  faKey,
  faLink,
  faMagnifyingGlassPlus,
  faSadTear,
  faShield,
  faStar,
  faUser,
  faUserCircle,
  faVoteYea
} from '@fortawesome/free-solid-svg-icons';
import {MatSort, MatSortModule} from "@angular/material/sort";
import {AccountCreationData} from "../../../interfaces";
import {DataService} from "../../../services/data.service";
import {Title, withIncrementalHydration} from "@angular/platform-browser";
import {MatAccordion, MatExpansionModule} from "@angular/material/expansion";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {ActionDetailsComponent} from "../../action-details/action-details.component";
import {ContractDialogComponent} from "../../contract-dialog/contract-dialog.component";
import {toObservable} from "@angular/core/rxjs-interop";
import {animate, scroll} from "motion";
import {ActDataViewComponent} from "../../act-data-view/act-data-view.component";
import {MatRipple} from "@angular/material/core";
import {PermissionTreeComponent} from "../../permission-tree/permission-tree.component";

interface Permission {
  perm_name: string;
  parent: string;
  required_auth: RequiredAuth;
  children?: Permission[];
}

interface RequiredAuth {
  threshold: number;
  keys: Keys[];
  accounts?: Accs[];
  waits?: Waits[];
}

interface Keys {
  key: string;
  weight: number;
}

interface Accs {
  permission: Perm;
  weight: number;
}

interface Perm {
  actor: string;
  permission: string;
}

interface Waits {
  wait_sec: number;
  weight: number;
}

/** Flat node with expandable and level information */
interface FlatNode {
  expandable: boolean;
  perm_name: string;
  level: number;
}

@Component({
  selector: 'app-account',
  imports: [
    MatButton,
    MatProgressSpinner,
    FaIconComponent,
    MatProgressBar,
    FaLayersComponent,
    MatTooltip,
    RouterLink,
    MatPaginator,
    DecimalPipe,
    MatAccordion,
    MatExpansionModule,
    MatTableModule,
    MatSortModule,
    MatColumnDef,
    MatHeaderCell,
    MatCell,
    NgClass,
    MatRow,
    MatHeaderRow,
    MatCardContent,
    MatCardHeader,
    DatePipe,
    ActDataViewComponent,
    MatRipple,
    PermissionTreeComponent
  ],
  templateUrl: './account.component.html',
  styleUrls: [
    './account.component.css',
    './action-table.css',
    './permissions-card.css'
  ]
})
export class AccountComponent implements OnInit {

  dataService = inject(DataService);
  acServ = inject(AccountService);
  readonly dialog = inject(MatDialog);
  platformId = inject(PLATFORM_ID);
  route = inject(ActivatedRoute);
  searchService = inject(SearchService);
  title = inject(Title);
  router = inject(Router);

  sort = viewChild<MatSort>(MatSort);
  paginator = viewChild<MatPaginator>(MatPaginator);
  balanceCard = viewChild<ElementRef<HTMLDivElement>>('balanceCard');
  actionsTable = viewChild<ElementRef<HTMLDivElement>>('actionsTable');

  icons = {
    solid: {
      faClock: faClock,
      faUserCircle: faUserCircle,
      faShield: faShield,
      faCircle: faCircle,
      faCheck: faCheck,
      faStar: faStar,
      faLink: faLink,
      faHistory: faHistory,
      faChevronRight: faChevronRight,
      faChevronDown: faChevronDown,
      faSadTear: faSadTear,
      faKey: faKey,
      faUser: faUser,
      faVote: faVoteYea,
      dots: faEllipsisV,
      glassMore: faMagnifyingGlassPlus
    },
    regular: {
      faQuestionCircle: faQuestionCircle
    }
  }

  displayedColumns: string[] = ['trx_id', 'action', 'data', 'block_num'];

  systemSymbol = '';

  creationData = signal<AccountCreationData>({
    creator: undefined,
    timestamp: undefined
  });

  systemTokenContract = 'eosio.token';
  private contractDialogRef?: MatDialogRef<ContractDialogComponent, any>;

  constructor() {

    this.searchService.searchType.set('account');

    this.route.paramMap.subscribe(value => {
      this.searchService.searchQuery.set(value.get('account_name') ?? "");
    });

    this.route.queryParamMap.subscribe(value => {
      if (value.has('table') || (value.has('table') && value.has('scope'))) {
        if (!this.contractDialogRef) {
          this.openContractsDialog(value.get('table'), value.get('scope'));
        }
      }
    });

    toObservable(this.balanceCard).subscribe((value) => {
      if (value && isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this.accountStickyMotion(this.balanceCard());
        }, 1000);
      }
    });

    toObservable(this.actionsTable).subscribe((value) => {
      if (value && isPlatformBrowser(this.platformId)) {
        this.tableStickyMotion(this.actionsTable());
      }
    });

    toObservable(this.acServ.accountDataRes.value).subscribe((value) => {

      if (!this.dataService.explorerMetadata) {
        return;
      }

      const accountName = this.acServ.accountName();
      const chainData = this.dataService.explorerMetadata;

      if (!chainData.chain_name) {
        this.title.setTitle(`${accountName} • Hyperion Explorer`);
      } else {
        this.title.setTitle(`${accountName} • ${chainData.chain_name} Hyperion Explorer`);
      }
    });
  }

  private accountStickyMotion(accountNameSticky?: ElementRef<HTMLDivElement>) {
    scroll(
      animate('#totalBalance', {x: [-100, 0], opacity: [0, 1]}, {duration: 1}),
      {target: accountNameSticky?.nativeElement, offset: ['start 200px', 'start 100px']}
    );
  }

  private tableStickyMotion(tableSticky?: ElementRef<HTMLDivElement>) {
    scroll(animate('.mat-mdc-header-row', {
        boxShadow: 'rgba(78 104 192, 0.25) 0px 4px 19px 0px, rgba(17, 12, 46, 0.15) 0px 20px 100px 0px',
        background: 'var(--table-top-bg-gradient)'
      }, {duration: 1}),
      {target: tableSticky?.nativeElement, offset: ['end 250px', '200px 250px']}
    );
  }

  transformer(node: Permission, level: number): any {
    return {
      expandable: !!node.children && node.children.length > 0,
      level,
      ...node
    };
  }

  ngOnInit(): void {
    this.route.params.subscribe(async (routeParams: any) => {

      // if (this.accountService.streamClientStatus) {
      //   this.accountService.disconnectStream();
      // }

      if (!this.dataService || !this.dataService.explorerMetadata) {
        return;
      }

      // const chainData = this.dataService.explorerMetadata;

      this.acServ.accountName.set(routeParams.account_name);

      // const accountLoaded = await this.acServ.loadAccountData(routeParams.account_name);

      // if (accountLoaded) {
      //
      //   // const customCoreToken = chainData.custom_core_token;
      //   // if (customCoreToken && customCoreToken !== '') {
      //   //   const parts = chainData.custom_core_token.split('::');
      //   //   this.systemSymbol = parts[1];
      //   //   this.systemTokenContract = parts[0];
      //   //   const coreBalance = this.acServ.jsonData.tokens.find((v: any) => {
      //   //     return v.symbol === this.systemSymbol && v.contract === this.systemTokenContract;
      //   //   });
      //   //   if (coreBalance) {
      //   //     this.acServ.account.core_liquid_balance = coreBalance.amount + ' ' + this.systemSymbol;
      //   //   }
      //   // } else {
      //   //   this.systemSymbol = this.getSymbol(this.acServ.account.core_liquid_balance) ?? "?";
      //   // }
      //
      //   // setTimeout(() => {
      //   //   // this.acServ.tableDataSource.sort = this.sort() || null;
      //   //   // this.acServ.tableDataSource.paginator = this.paginator() || null;
      //   // }, 500);
      //
      //   // const creationData = await this.acServ.getCreator(routeParams.account_name);
      //   // if (creationData) {
      //   //   this.creationData.set({creator: creationData.creator, timestamp: creationData.timestamp});
      //   // }
      //
      // }

    });
  }

  getSymbol(asset: string): string | null {
    if (asset) {
      try {
        return asset.split(' ')[1];
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  getChildren(arr: Permission[], parent: string): Permission[] {
    return arr.filter(value => value.parent === parent).map((value) => {
      const children = this.getChildren(arr, value.perm_name);
      if (children.length > 0) {
        value.children = children;
      }
      return value;
    });
  }

  convertBytes(bytes: number): string {
    if (bytes > (1024 ** 3)) {
      return (bytes / (1024 ** 3)).toFixed(2) + ' GB';
    }
    if (bytes > (1024 ** 2)) {
      return (bytes / (1024 ** 2)).toFixed(2) + ' MB';
    }
    if (bytes > 1024) {
      return (bytes / (1024)).toFixed(2) + ' KB';
    }
    return bytes + ' bytes';
  }

  changePage(event: PageEvent): void {

    // disable streaming if enabled
    // if (this.accountService.streamClientStatus) {
    //   this.accountService.toggleStreaming();
    // }

    const maxPages = Math.floor(event.length / event.pageSize);
    console.log(event);
    console.log(`${event.pageIndex} / ${maxPages}`);
    try {
      if (event.pageIndex === maxPages - 1 && this.acServ.accountName()) {
        this.acServ.loadMoreActions().catch(console.log);
      }
    } catch (e) {
      console.log(e);
    }
  }

  openContractsDialog(table: string | null, scope: string | null): void {
    console.log('Opening contract dialog');
    if (this.searchService.searchQuery()) {
      this.contractDialogRef = this.dialog.open<ContractDialogComponent>(ContractDialogComponent, {
        width: '1024px',
        height: 'auto',
        restoreFocus: true,
        data: {
          account: this.searchService.searchQuery(),
          table: table,
          scope: scope
        },
        autoFocus: false,
        panelClass: ['responsive-modal'],
      });

      this.contractDialogRef.afterClosed().subscribe(() => {
        this.contractDialogRef = undefined;
        console.log('Contract Dialog closed');
        // clear query params
        this.router.navigate([], {
          queryParams: {}
        }).catch(console.log);
      });

    }
  }

  formatEVMValue(value: any) {
    return Number(((value as bigint) / 1000000000000000000n)).toFixed(4);
  }

  checkKey(action: any, key: any) {
    return action['act']['account'] === 'eosio.evm' && action['act']['name'] === 'raw' && ['to', 'from', 'hash', 'value', 'block'].includes(key as string);
  }

  asArray(value: any): any[] {
    return value;
  }

  onRowClick(row: any) {
    const dialogRef = this.dialog.open(ActionDetailsComponent, {
      width: '1024px',
      height: 'auto',
      autoFocus: false,
      panelClass: ['responsive-modal'],
      data: {
        action: row
      }
    });

    dialogRef.afterClosed().subscribe(value => {
      console.log('Action Detail dialog closed!');
      console.log(value);
    });
  }

  toRecord(value: any): Record<string, any> {
    return value;
  }
}
