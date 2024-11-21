import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {
  faCircle,
  faExchangeAlt,
  faHistory,
  faHourglassStart,
  faLock,
  faSadTear,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import {Title} from '@angular/platform-browser';
import {AccountService} from "../../../services/account.service";
import {DataService} from "../../../services/data.service";
import {SearchService} from "../../../services/search.service";
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {FaIconComponent, FaLayersComponent} from "@fortawesome/angular-fontawesome";
import {MatChipListbox, MatChipOption} from "@angular/material/chips";
import {MatTableModule} from "@angular/material/table";
import {KeyValuePipe, NgClass} from "@angular/common";

@Component({
  selector: 'app-transaction',
  imports: [
    MatProgressSpinner,
    FaIconComponent,
    FaLayersComponent,
    MatChipListbox,
    MatChipOption,
    RouterLink,
    MatTableModule,
    KeyValuePipe,
    NgClass
  ],
  templateUrl: './transaction.component.html',
  standalone: true,
  styleUrls: ['./transaction.component.css']
})
export class TransactionComponent implements OnInit, OnDestroy {

  columnsToDisplay: string[] = ['contract', 'action', 'data', 'auth'];

  tx = signal<any>({
    actions: null
  });

  icons = {
    solid: {
      faCircle: faCircle,
      faExchange: faExchangeAlt,
      faLock: faLock,
      faHourglass: faHourglassStart,
      faHistory: faHistory,
      faSadTear: faSadTear,
      faSpinner: faSpinner
    }
  }

  txID = this.searchService.searchQuery.asReadonly();

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
              public searchService: SearchService,
              public accountService: AccountService,
              public data: DataService,
              private title: Title) {
  }

  ngOnInit(): void {

    this.searchService.searchType.set('transaction');

    this.route.paramMap.subscribe(async (value) => {

      this.searchService.searchQuery.set(value.get('transaction_id') ?? "");

      const trxId = this.txID();
      this.tx.set(await this.accountService.loadTxData(trxId));

      const chainData = this.data.explorerMetadata;

      if (chainData && chainData.chain_name) {
        this.title.setTitle(`TX ${trxId.slice(0, 8)} • ${chainData.chain_name} Hyperion Explorer`);
      } else {
        this.title.setTitle(`TX ${trxId.slice(0, 8)} • Hyperion Explorer`);
      }

      const tx = this.tx();

      if (tx) {
        this.accountService.libNum.set(tx.lib);
        if (tx.actions[0].block_num > tx.lib) {
          await this.reloadCountdownTimer();
          this.countdownLoop = setInterval(async () => {
            this.countdownTimer--;
            if (this.countdownTimer <= 0) {
              await this.reloadCountdownTimer();
              if (this.accountService.libNum > tx.actions[0].block_num) {
                clearInterval(this.countdownLoop);
              }
            }
          }, 1000);
        }
      }

    });
  }

  ngOnDestroy(): void {
    if (this.countdownLoop) {
      console.log('Clearing countdown loop');
      clearInterval(this.countdownLoop);
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  async reloadCountdownTimer(): Promise<void> {
    await this.accountService.updateLib();
    const lib = this.accountService.libNum();
    if (!lib) {
      return;
    }
    this.countdownTimer = Math.ceil((this.tx().actions[0].block_num - lib) / 2);
  }
}
