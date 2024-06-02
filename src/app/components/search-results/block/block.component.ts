import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {animate, state, style, transition, trigger} from "@angular/animations";
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {MatCard} from "@angular/material/card";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {MatChipsModule} from "@angular/material/chips";
import {MatTableModule} from "@angular/material/table";
import {MatIconButton} from "@angular/material/button";
import {ActivatedRoute, RouterModule} from "@angular/router";
import {KeyValuePipe, NgClass} from "@angular/common";
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

@Component({
  selector: 'app-block',
  standalone: true,
  imports: [
    RouterModule,
    MatChipsModule,
    MatTableModule,
    FontAwesomeModule,
    MatProgressSpinner,
    MatCard,
    MatIconButton,
    NgClass,
    KeyValuePipe
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
    this.countdownTimer = Math.ceil((this.block().number - this.accountService.libNum) / 2);
  }

  ngOnDestroy(): void {
    if (this.countdownLoop) {
      clearInterval(this.countdownLoop);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

}
