import {Component} from '@angular/core';
import {SearchService} from "../../../services/search.service";
import {MatButton} from "@angular/material/button";
import {ActivatedRoute, Router} from "@angular/router";
import {MatDialog} from "@angular/material/dialog";
import {ContractDialogComponent} from "../../contract-dialog/contract-dialog.component";

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    MatButton
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent {
  constructor(
    private route: ActivatedRoute,
    private searchService: SearchService,
    // private dialog: MatDialog,
    private router: Router,
  ) {
    this.searchService.searchType.set('account');
    this.route.paramMap.subscribe(value => {
      this.searchService.searchQuery.set(value.get('account_name') ?? "");
    });
  }

  openContractExplorer() {

    if (this.searchService.searchQuery()) {
      // this.dialog.open(ContractDialogComponent, {
      //   data: {
      //     code: this.searchService.searchQuery()
      //   }
      // });
      this.router.navigate(['contract', this.searchService.searchQuery()]).catch(console.error);
    }
  }
}
