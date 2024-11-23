import {Component, ElementRef, inject, PLATFORM_ID, signal, viewChild} from '@angular/core';
import {SearchService} from "../../../services/search.service";
import {MatButton, MatIconButton} from "@angular/material/button";
import {ActivatedRoute, Router, RouterLink} from "@angular/router";
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {MatCardContent, MatCardHeader} from "@angular/material/card";
import {FaIconComponent, FaLayersComponent} from "@fortawesome/angular-fontawesome";
import {MatProgressBar} from "@angular/material/progress-bar";
import {MatTooltip} from "@angular/material/tooltip";
import {
  MatTree,
  MatTreeFlatDataSource,
  MatTreeFlattener,
  MatTreeModule,
  MatTreeNode,
  MatTreeNodePadding,
  MatTreeNodeToggle
} from "@angular/material/tree";
import {DatePipe, DecimalPipe, isPlatformBrowser, NgClass} from "@angular/common";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {MatCell, MatColumnDef, MatHeaderCell, MatHeaderRow, MatRow, MatTableModule} from "@angular/material/table";
import {AccountService} from "../../../services/account.service";
import {faQuestionCircle} from "@fortawesome/free-regular-svg-icons";
import {
  faChevronDown,
  faChevronRight,
  faCircle,
  faClock, faEllipsisV,
  faHistory,
  faKey,
  faLink, faMagnifyingGlassPlus,
  faSadTear,
  faStar,
  faUser,
  faUserCircle,
  faVoteYea
} from '@fortawesome/free-solid-svg-icons';
import {MatSort, MatSortModule} from "@angular/material/sort";
import {FlatTreeControl} from "@angular/cdk/tree";
import {AccountCreationData} from "../../../interfaces";
import {DataService} from "../../../services/data.service";
import {Title} from "@angular/platform-browser";
import {MatAccordion, MatExpansionModule} from "@angular/material/expansion";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {ActionDetailsComponent} from "../../action-details/action-details.component";
import {ContractDialogComponent} from "../../contract-dialog/contract-dialog.component";
import {toObservable} from "@angular/core/rxjs-interop";
import {animate, scroll} from "motion";
import {ActDataViewComponent} from "../../act-data-view/act-data-view.component";
import {MatRipple} from "@angular/material/core";

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
    MatTree,
    MatTreeNode,
    MatIconButton,
    MatTreeNodeToggle,
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
    MatTreeNodePadding,
    MatRow,
    MatHeaderRow,
    MatCardContent,
    MatCardHeader,
    MatTreeModule,
    DatePipe,
    ActDataViewComponent,
    MatRipple
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent {

  dataService = inject(DataService);
  accountService = inject(AccountService);
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
      faCircle: faCircle,
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

  accountName: string = '';

  displayedColumns: string[] = ['trx_id', 'action', 'data', 'block_num'];

  treeControl: FlatTreeControl<FlatNode>;

  treeFlattener: MatTreeFlattener<any, any>;

  dataSource: MatTreeFlatDataSource<any, any>;
  detailedView = true;

  systemPrecision = 4;
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

    this.treeControl = new FlatTreeControl<FlatNode>(
      node => node.level, node => node.expandable
    );

    this.treeFlattener = new MatTreeFlattener(
      this.transformer, node => node.level, node => node.expandable, node => node.children
    );

    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

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

  }

  private accountStickyMotion(accountNameSticky?: ElementRef<HTMLDivElement>) {
    const offset: any = ['start 200px', 'start 100px'];

    scroll(animate('#totalBalance', {x: [-100, 0], opacity: [0, 1]}, {duration: 1}),
      {target: accountNameSticky?.nativeElement, offset}
    );
    // scroll(
    //   (progress: any) => {
    //     console.log(progress);
    //   },
    //   {target: accountNameSticky?.nativeElement, offset}
    // );
  }

  private tableStickyMotion(tableSticky?: ElementRef<HTMLDivElement>) {
    scroll(animate('.mat-mdc-header-row', {
        boxShadow: 'rgba(78 104 192, 0.25) 0px 4px 19px 0px, rgba(17, 12, 46, 0.15) 0px 20px 100px 0px',
        background: 'linear-gradient(115deg, rgb(255 255 255 / 40%) 0%, rgb(255 255 255 / 90%) 87%, rgb(255 255 255 / 40%) 130%), var(--main-background)'
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

  objectKeyCount(obj: any): number {
    try {
      return Object.keys(obj).length;
    } catch (e) {
      return 0;
    }
  }

  hasChild = (_: number, node: FlatNode) => node.expandable;


  ngOnInit(): void {
    this.route.params.subscribe(async (routeParams: any) => {

      // if (this.accountService.streamClientStatus) {
      //   this.accountService.disconnectStream();
      // }

      if (!this.dataService || !this.dataService.explorerMetadata) {
        return;
      }

      const chainData = this.dataService.explorerMetadata;

      this.accountName = routeParams.account_name;
      if (await this.accountService.loadAccountData(routeParams.account_name)) {

        if (!chainData.chain_name) {
          this.title.setTitle(`${this.accountName} • Hyperion Explorer`);
        } else {
          this.title.setTitle(`${this.accountName} • ${chainData.chain_name} Hyperion Explorer`);
        }

        const customCoreToken = chainData.custom_core_token;
        if (customCoreToken && customCoreToken !== '') {
          const parts = chainData.custom_core_token.split('::');
          this.systemSymbol = parts[1];
          this.systemTokenContract = parts[0];
          const coreBalance = this.accountService.jsonData.tokens.find((v: any) => {
            return v.symbol === this.systemSymbol && v.contract === this.systemTokenContract;
          });
          if (coreBalance) {
            this.accountService.account.core_liquid_balance = coreBalance.amount + ' ' + this.systemSymbol;
          }
        } else {
          this.systemSymbol = this.getSymbol(this.accountService.account.core_liquid_balance) ?? "?";
        }

        this.systemPrecision = this.getPrecision(this.accountService.account.core_liquid_balance);
        if (this.systemSymbol === null) {
          try {
            this.systemSymbol = this.getSymbol(this.accountService.account.total_resources.cpu_weight) ?? "?";
            if (this.systemSymbol === null) {
              this.systemSymbol = 'SYS';
            }
          } catch (e) {
            this.systemSymbol = 'SYS';
          }
        }
        this.processPermissions();
        setTimeout(() => {
          this.accountService.tableDataSource.sort = this.sort() || null;
          this.accountService.tableDataSource.paginator = this.paginator() || null;
        }, 500);
        const creationData = await this.accountService.getCreator(routeParams.account_name);
        if (creationData) {
          this.creationData.set({creator: creationData.creator, timestamp: creationData.timestamp});
        }
      }
    });
  }

  getPrecision(asset: string): number {
    if (asset) {
      try {
        return asset.split(' ')[0].split('.')[1].length;
      } catch (e) {
        return 4;
      }
    } else {
      return 4;
    }
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

  liquidBalance(): number {
    if (this.accountService.account.core_liquid_balance) {
      return parseFloat(this.accountService.account.core_liquid_balance.split(' ')[0]);
    }
    return 0;
  }

  myCpuBalance(): number {
    if (this.accountService.account.self_delegated_bandwidth) {
      return parseFloat(this.accountService.account.self_delegated_bandwidth.cpu_weight.split(' ')[0]);
    }
    return 0;
  }

  myNetBalance(): number {
    if (this.accountService.account.self_delegated_bandwidth) {
      return parseFloat(this.accountService.account.self_delegated_bandwidth.net_weight.split(' ')[0]);
    }
    return 0;
  }

  cpuBalance(): number {
    if (this.accountService.account.total_resources) {
      return parseFloat(this.accountService.account.total_resources.cpu_weight.split(' ')[0]);
    }
    return 0;
  }

  netBalance(): number {
    if (this.accountService.account.total_resources) {
      return parseFloat(this.accountService.account.total_resources.net_weight.split(' ')[0]);
    }
    return 0;
  }

  totalBalance(): number {
    const liquid = this.liquidBalance();
    const cpu = this.myCpuBalance();
    const net = this.myNetBalance();
    return liquid + cpu + net;
  }

  stakedBalance(): number {
    const cpu = this.myCpuBalance();
    const net = this.myNetBalance();
    return cpu + net;
  }

  cpuByOthers(): number {
    const cpu = this.cpuBalance();
    const mycpu = this.myCpuBalance();
    return cpu - mycpu;
  }

  netByOthers(): number {
    const net = this.netBalance();
    const mynet = this.myNetBalance();
    return net - mynet;
  }

  stakedbyOthers(): number {
    const cpu = this.cpuBalance();
    const net = this.netBalance();
    const mycpu = this.myCpuBalance();
    const mynet = this.myNetBalance();
    return (cpu + net) - (mycpu + mynet);
  }

  refundBalance(): number {
    let cpuRefund = 0;
    let netRefund = 0;
    if (this.accountService.account.refund_request) {
      cpuRefund = parseFloat(this.accountService.account.refund_request.cpu_amount.split(' ')[0]);
      netRefund = parseFloat(this.accountService.account.refund_request.net_amount.split(' ')[0]);
    }
    return cpuRefund + netRefund;
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

  private processPermissions(): void {
    if (this.accountService.account) {
      const permissions: Permission[] = this.accountService.account.permissions;
      if (permissions) {
        try {
          this.dataSource.data = this.getChildren(permissions, '');
          this.treeControl.expand(this.treeControl.dataNodes[0]);
          this.treeControl.expand(this.treeControl.dataNodes[1]);
        } catch (e) {
          console.log(e);
          this.dataSource.data = [];
        }
      }
    }
  }

  isArray(value: any): boolean {
    return value !== null && typeof value === 'object' && value.length > 0;
  }

  getType(subitem: any): string {
    return typeof subitem;
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

  convertMicroS(micros: number): string {
    let int = 0;
    let remainder = 0;
    const calcSec = 1000 ** 2;
    const calcMin = calcSec * 60;
    const calcHour = calcMin * 60;
    if (micros > calcHour) {
      int = Math.floor(micros / calcHour);
      remainder = micros % calcHour;
      return int + 'h ' + Math.round(remainder / calcMin) + 'min';
    }
    if (micros > calcMin) {
      int = Math.floor(micros / calcMin);
      remainder = micros % calcMin;
      return int + 'min ' + Math.round(remainder / calcSec) + 's';
    }
    if (micros > calcSec) {
      return (micros / calcSec).toFixed(2) + 's';
    }
    if (micros > 1000) {
      return (micros / (1000)).toFixed(2) + 'ms';
    }
    return micros + 'µs';
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
      if (event.pageIndex === maxPages - 1 && this.accountName) {
        this.accountService.loadMoreActions(this.accountName).catch(console.log);
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
