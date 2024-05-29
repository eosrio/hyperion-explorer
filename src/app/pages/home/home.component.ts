import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Inject,
  PLATFORM_ID,
  signal,
  viewChild
} from '@angular/core';
import {PreHeaderComponent} from "../../components/pre-header/pre-header.component";
import {MatCard} from "@angular/material/card";
import {isPlatformBrowser, NgOptimizedImage} from "@angular/common";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {MatError, MatFormField, MatSuffix} from "@angular/material/form-field";
import {faHeart, faSearch} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {SearchService} from "../../services/search.service";
import {MatAutocomplete, MatAutocompleteTrigger, MatOption} from "@angular/material/autocomplete";
import {MatInput} from "@angular/material/input";
import {MatButton} from "@angular/material/button";
import {DataService} from "../../services/data.service";
import {ExplorerMetadata} from "../../interfaces";
import {MatIcon} from "@angular/material/icon";
import {ActivatedRoute, Router, RouterOutlet} from "@angular/router";
import {debounceTime} from "rxjs";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    PreHeaderComponent,
    MatCard,
    NgOptimizedImage,
    ReactiveFormsModule,
    MatFormField,
    FaIconComponent,
    MatAutocomplete,
    MatOption,
    MatInput,
    MatAutocompleteTrigger,
    MatError,
    MatButton,
    MatSuffix,
    MatIcon,
    RouterOutlet
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {


  icons = {
    solid: {
      search: faSearch,
      heart: faHeart
    }
  }

  // local signals
  public chainData = signal<ExplorerMetadata>({} as ExplorerMetadata);

  // shared signals
  searchValue = this.searchService.searchQuery.asReadonly();
  searchType = this.searchService.searchType.asReadonly();
  searchField = viewChild<ElementRef<HTMLInputElement>>('searchField');

  filteredAccounts = signal<string[]>([]);

  searchForm: FormGroup;
  systemAccounts = ["eosio", "eosio.token", "eosio.msig"];
  searchPlaceholder = signal<string>("");

  private currentPlaceholder = 0;
  placeholders = [
    'Search by account name...',
    'Search by block number...',
    'Search by transaction id...',
    'Search by EVM hash...',
    'Search by public key...'
  ];

  err = signal("");


  constructor(
    private dataService: DataService,
    private formBuilder: FormBuilder,
    private searchService: SearchService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {

    if (this.dataService.explorerMetadata) {
      this.chainData.set(this.dataService.explorerMetadata);
      // console.log(this.dataService.explorerMetadata);
    }

    this.searchForm = this.formBuilder.group({
      search_field: ['', Validators.required]
    });

    this.searchPlaceholder.set(this.placeholders[0]);

    this.searchForm.get('search_field')?.valueChanges?.pipe(debounceTime(300))?.subscribe((value) => {
      if (value && value.length > 2) {
        this.searchService.filterAccountNames(value).then((filteredAccounts: string[]) => {
          this.filteredAccounts.set(filteredAccounts
            .concat(this.systemAccounts.filter(acct => acct.startsWith(value)))
            .sort((a, b) => a.localeCompare(b))
          );
        });
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      setInterval(() => {
        this.currentPlaceholder++;
        if (!this.placeholders[this.currentPlaceholder]) {
          this.currentPlaceholder = 0;
        }
        this.searchPlaceholder.set(this.placeholders[this.currentPlaceholder]);
      }, 2000);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyPressed(event: KeyboardEvent) {
    // detect Ctrl+Shift+F
    if (event.ctrlKey && event.shiftKey && event.key === 'F') {
      console.log('Focus on search field', this.searchField());
      // focus on the search_field of this.searchForm
      this.searchField()?.nativeElement.focus();
    }
  }

  async submit(): Promise<void> {
    if (!this.searchForm.valid) {
      return;
    }
    const searchText = this.searchForm.get('search_field')?.value;
    if (searchText) {
      this.searchForm.reset();
      const status = this.searchService.submitSearch(searchText, this.filteredAccounts());
      if (!status) {
        this.err.set('no results for ' + searchText);
      } else {
        this.err.set("");
        await this.router.navigateByUrl(`/${this.searchType()}/${this.searchValue()}`);
      }
    }
  }
}
