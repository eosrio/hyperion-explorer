import {Component, ElementRef, inject, OnDestroy, OnInit, PLATFORM_ID, viewChild} from '@angular/core';
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
import {Title} from "@angular/platform-browser";
import {SearchService} from "../../../services/search.service";
import {DataService} from "../../../services/data.service";
import {animate as motionAnimate, scroll} from "motion";
import {toObservable} from "@angular/core/rxjs-interop";
import {ActDataViewComponent} from "../../act-data-view/act-data-view.component";
import {BlockService} from "../../../services/block.service";
import {ChainService} from "../../../services/chain.service";
import {DeltaService} from "../../../services/delta.service";
import {MatTooltip} from "@angular/material/tooltip";

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
    KeyValuePipe,
    ActDataViewComponent,
    MatTooltip
  ],
  templateUrl: './block.component.html',
  styleUrl: './block.component.css',
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class BlockComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private dataService = inject(DataService);
  private searchService = inject(SearchService);
  private title = inject(Title);

  // block service
  blockService = inject(BlockService);
  deltaService = inject(DeltaService);
  chain = inject(ChainService);

  txColumnsToDisplay: string[] = ['icon', 'id', 'root', 'action'];
  txColumnsInside: string[] = ['action', 'data', 'auth'];
  txExpandedElement: any | null;

  deltasColumnsToDisplay: string[] = ['present', 'location', 'payer', 'data'];

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

  countdownLoop: any;
  countdownTimer = 0;
  transactionsTable = viewChild<ElementRef<HTMLDivElement>>('transactionsTable');
  deltasTable = viewChild<ElementRef<HTMLDivElement>>('deltasTable');
  platformId = inject(PLATFORM_ID);

  objectKeyCount(obj: any): number {
    try {
      return Object.keys(obj).length;
    } catch (e) {
      return 0;
    }
  }

  constructor() {

    toObservable(this.transactionsTable).subscribe((value) => {
      if (value && isPlatformBrowser(this.platformId)) {
        this.tableStickyMotion('.transactions-table-header', value);
      }
    });

    toObservable(this.deltasTable).subscribe((value) => {
      if (value && isPlatformBrowser(this.platformId)) {
        this.tableStickyMotion('.deltas-table-header', value);
      }
    });
  }

  ngOnInit(): void {
    this.searchService.searchType.set('block');

    this.route.paramMap.subscribe(async value => {
      const block_num_or_id = value.get('block_num_or_id')?.trim();

      console.log('block_num_or_id', block_num_or_id);

      if (block_num_or_id) {
        if (block_num_or_id.length === 64) {
          this.blockService.blockId.set(block_num_or_id);
          this.blockService.blockNum.set(0);

          this.deltaService.blockId.set(block_num_or_id);
          this.deltaService.blockNum.set(null);
        } else {
          const blockNum = parseInt(block_num_or_id);
          this.blockService.blockNum.set(blockNum);
          this.blockService.blockId.set("");

          this.deltaService.blockNum.set(blockNum);
          this.deltaService.blockId.set(null);
        }
      }

      this.searchService.searchQuery.set(value.get('block_num_or_id') ?? "");
      if (!this.dataService.explorerMetadata?.chain_name) {
        this.title.setTitle(`Block ${this.blockService.blockNum()} • Hyperion Explorer`);
      } else {
        this.title.setTitle(`Block ${this.blockService.blockNum()} • ${this.dataService.explorerMetadata.chain_name} Hyperion Explorer`);
      }

      // if (this.block && this.block().status === 'pending') {
      //   await this.reloadCountdownTimer();
      //   this.countdownLoop = setInterval(async () => {
      //     this.countdownTimer--;
      //     if (this.countdownTimer <= 0) {
      //       await this.reloadCountdownTimer();
      //       if (this.accountService.libNum > this.block().number) {
      //         clearInterval(this.countdownLoop);
      //       }
      //     }
      //   }, 1000);
      // }

    });
  }

  // async reloadCountdownTimer(): Promise<void> {
  //   await this.accountService.updateLib();
  //   const lib = this.accountService.libNum();
  //   if (lib) {
  //     this.countdownTimer = Math.ceil((this.block().number - lib) / 2);
  //   }
  // }

  ngOnDestroy(): void {
    if (this.countdownLoop) {
      clearInterval(this.countdownLoop);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  private tableStickyMotion(target: string, tableSticky?: ElementRef<HTMLDivElement>) {
    scroll(motionAnimate(target, {
        boxShadow: 'rgba(78 104 192, 0.25) 0px 4px 19px 0px, rgba(17, 12, 46, 0.15) 0px 20px 100px 0px',
        background: 'var(--table-top-bg-gradient)'
      }, {duration: 1}),
      {target: tableSticky?.nativeElement, offset: ['end 250px', '200px 250px']}
    );
  }

}
