import {Component, OnInit, signal} from '@angular/core';
import {ActivatedRoute, RouterLink} from "@angular/router";
import {AccountService} from "../../../services/account.service";
import {DataService} from '../../../services/data.service';
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner';
import {faSadTear} from '@fortawesome/free-solid-svg-icons/faSadTear';
import {faKey} from '@fortawesome/free-solid-svg-icons/faKey';
import {faCircle} from '@fortawesome/free-solid-svg-icons/faCircle';
import {Title} from "@angular/platform-browser";
import {SearchService} from "../../../services/search.service";
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {MatCard} from "@angular/material/card";
import {FaIconComponent, FaLayersComponent} from "@fortawesome/angular-fontawesome";

interface KeyResponse {
  account_names: string[];
  permissions: any[];
}

@Component({
  selector: 'app-key',
  standalone: true,
  imports: [
    RouterLink,
    MatProgressSpinner,
    MatCard,
    FaIconComponent,
    FaLayersComponent
  ],
  templateUrl: './key.component.html',
  styleUrl: './key.component.css'
})
export class KeyComponent implements OnInit {

  key = signal<KeyResponse>({} as KeyResponse);

  pubKey = this.searchService.searchQuery.asReadonly();

  icons = {
    solid: {
      faCircle: faCircle,
      faKey: faKey,
      faSadTear: faSadTear,
      faSpinner: faSpinner
    }
  }

  constructor(private route: ActivatedRoute,
              public accountService: AccountService,
              private searchService: SearchService,
              public data: DataService,
              private title: Title) {
  }

  ngOnInit(): void {

    this.searchService.searchType.set('key');

    this.route.paramMap.subscribe(async value => {

      this.searchService.searchQuery.set(value.get('pub_key') ?? "");

      this.key.set(await this.accountService.loadPubKey(this.pubKey()) as KeyResponse);

      const chainData = this.data.explorerMetadata;

      if (chainData && chainData.chain_name) {
        this.title.setTitle(`🔑 ${this.pubKey().slice(0, 12)} • ${chainData.chain_name} Hyperion Explorer`);
      } else {
        this.title.setTitle(`🔑 ${this.pubKey().slice(0, 12)} • Hyperion Explorer`);
      }

    });
  }

}
