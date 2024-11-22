import {Component, ElementRef, inject, OnDestroy, OnInit, PLATFORM_ID, signal, viewChild} from '@angular/core';
import {animate, state, style, transition, trigger} from "@angular/animations";
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {MatChipsModule} from "@angular/material/chips";
import {MatTableModule} from "@angular/material/table";
import {MatIconButton} from "@angular/material/button";
import {ActivatedRoute, RouterModule} from "@angular/router";
import {isPlatformBrowser, KeyValuePipe, NgClass} from "@angular/common";
import {
  faChevronDown,
  faChevronRight,
  faCircle,
  faCube,
  faHistory,
  faHourglassStart,
  faLock,
  faSadTear,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import {AccountService} from "../../../services/account.service";
import {Title} from "@angular/platform-browser";
import {SearchService} from "../../../services/search.service";
import {DataService} from "../../../services/data.service";
import {scroll, animate as motionAnimate} from "motion";
import {toObservable} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-block',
  imports: [
    RouterModule,
    MatChipsModule,
    MatTableModule,
    FontAwesomeModule,
    MatProgressSpinner,
    MatIconButton,
    NgClass,
    KeyValuePipe
  ],
  templateUrl: './block.component.html',
  styleUrl: './block.component.css',
  standalone: true,
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class BlockComponent implements OnInit, OnDestroy {
  columnsToDisplay: string[] = ['icon', 'id', 'root', 'action'];
  columnsInside: string[] = ['action', 'data', 'auth'];
  expandedElement: any | null;

  icons = {
    solid: {
      faCircle: faCircle,
      faBlock: faCube,
      faLock: faLock,
      faHourglass: faHourglassStart,
      faHistory: faHistory,
      faChevronRight: faChevronRight,
      faChevronDown: faChevronDown,
      faSadTear: faSadTear,
      faSpinner: faSpinner
    }
  }

  block = signal<any>({
    transactions: [],
    status: '',
    number: 0
  });


  blockNum = signal<number>(0);
  blockId = signal<string>("");

  countdownLoop: any;
  countdownTimer = 0;
  actionsTable = viewChild<ElementRef<HTMLDivElement>>('actionsTable');
  platformId = inject(PLATFORM_ID);

  objectKeyCount(obj: any): number {
    try {
      return Object.keys(obj).length;
    } catch (e) {
      return 0;
    }
  }

  constructor(private route: ActivatedRoute,
              private dataService: DataService,
              private searchService: SearchService,
              public accountService: AccountService,
              private title: Title) {

    toObservable(this.actionsTable).subscribe((value) => {
      if (value && isPlatformBrowser(this.platformId)) {
        this.tableStickyMotion(this.actionsTable());
      }
    });
  }

  ngOnInit(): void {

    this.searchService.searchType.set('block');

    this.route.paramMap.subscribe(async value => {

      const block_num_or_id = value.get('block_num_or_id');
      if (block_num_or_id) {
        if (block_num_or_id.length === 64) {
          this.blockId.set(block_num_or_id);
        } else {
          this.blockNum.set(parseInt(block_num_or_id));
        }
      }

      this.searchService.searchQuery.set(value.get('block_num_or_id') ?? "");

      const blockData = await this.accountService.loadBlockData(this.blockNum());

      // TODO: remove after testing
      for (let i = 0; i < 20; i++) {
        blockData.transactions.push(blockData.transactions[0]);
      }
      // END TODO

      if (blockData) {
        this.block.set(blockData);
      }

      if (!this.dataService.explorerMetadata?.chain_name) {
        this.title.setTitle(`#${this.blockNum()} • Hyperion Explorer`);
      } else {
        this.title.setTitle(`#${this.blockNum()} • ${this.dataService.explorerMetadata.chain_name} Hyperion Explorer`);
      }

      if (this.block && this.block().status === 'pending') {
        await this.reloadCountdownTimer();
        this.countdownLoop = setInterval(async () => {
          this.countdownTimer--;
          if (this.countdownTimer <= 0) {
            await this.reloadCountdownTimer();
            if (this.accountService.libNum > this.block().number) {
              clearInterval(this.countdownLoop);
            }
          }
        }, 1000);
      }

    });
  }

  async reloadCountdownTimer(): Promise<void> {
    await this.accountService.updateLib();
    const lib = this.accountService.libNum();
    if (lib) {
      this.countdownTimer = Math.ceil((this.block().number - lib) / 2);
    }
  }

  ngOnDestroy(): void {
    if (this.countdownLoop) {
      clearInterval(this.countdownLoop);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  private tableStickyMotion(tableSticky?: ElementRef<HTMLDivElement>) {
    scroll(motionAnimate('.transactions-table-header', {
        boxShadow: 'rgba(78 104 192, 0.25) 0px 4px 19px 0px, rgba(17, 12, 46, 0.15) 0px 20px 100px 0px',
        background: 'linear-gradient(115deg, rgb(255 255 255 / 40%) 0%, rgb(255 255 255 / 90%) 87%, rgb(255 255 255 / 40%) 130%), var(--main-background)'
      }, {duration: 1}),
      {target: tableSticky?.nativeElement, offset: ['end 250px', '200px 250px']}
    );
  }

}
