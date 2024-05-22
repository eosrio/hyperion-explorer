import {Component, ElementRef, HostListener, Inject, PLATFORM_ID, signal, viewChild} from '@angular/core';
import {PreHeaderComponent} from "../../components/pre-header/pre-header.component";
import {MatCard} from "@angular/material/card";
import {isPlatformBrowser, isPlatformServer, NgOptimizedImage} from "@angular/common";
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
    MatIcon
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

  searchField = viewChild<ElementRef<HTMLInputElement>>('searchField');

  icons = {
    solid: {
      search: faSearch,
      heart: faHeart
    }
  }

  public chainData = signal<ExplorerMetadata>({} as ExplorerMetadata);

  searchForm: FormGroup;
  filteredAccounts: string[];
  searchPlaceholder: string;

  placeholders = [
    'Search by account name...',
    'Search by block number...',
    'Search by transaction id...',
    'Search by public key...'
  ];
  err = '';
  private currentPlaceholder = 0;

  constructor(
    private dataService: DataService,
    private formBuilder: FormBuilder,
    private searchService: SearchService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {

    if (this.dataService.explorerMetadata) {
      this.chainData.set(this.dataService.explorerMetadata);
      console.log(this.dataService.explorerMetadata);
    }

    this.searchForm = this.formBuilder.group({
      search_field: ['', Validators.required]
    });
    this.filteredAccounts = [];
    this.searchPlaceholder = this.placeholders[0];

    if (isPlatformBrowser(this.platformId)) {

      setInterval(() => {
        this.currentPlaceholder++;
        if (!this.placeholders[this.currentPlaceholder]) {
          this.currentPlaceholder = 0;
        }
        this.searchPlaceholder = this.placeholders[this.currentPlaceholder];
      }, 2000);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyPressed(event: KeyboardEvent) {
    // detect Ctrl+Shift+F
    if (event.ctrlKey && event.shiftKey && event.key === 'F') {
      console.log('Focus on search field',this.searchField());
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
      const status = this.searchService.submitSearch(searchText, this.filteredAccounts);
      if (!status) {
        this.err = 'no results for ' + searchText;
      }
    }
  }

  protected readonly faSearch = faSearch;
  searchValue = signal<string | null>(null);
  searchType = signal<string | null>(null);
}
