import {
  afterNextRender,
  Component,
  ElementRef,
  HostListener,
  Inject,
  inject, OnInit,
  PLATFORM_ID,
  signal,
  viewChild
} from '@angular/core';
import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {PreHeaderComponent} from "../../components/pre-header/pre-header.component";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {isPlatformBrowser, NgOptimizedImage} from "@angular/common";
import {SearchService} from "../../services/search.service";
import {AccountService} from "../../services/account.service";
import {DataService} from "../../services/data.service";
import {faSearch} from "@fortawesome/free-solid-svg-icons";
import {toObservable} from "@angular/core/rxjs-interop";
import {ExplorerMetadata} from "../../interfaces";
import {MatAutocomplete, MatAutocompleteTrigger, MatOption} from "@angular/material/autocomplete";
import {Router, RouterLink, RouterOutlet} from "@angular/router";
import {debounceTime} from "rxjs";
import {MatButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";


@Component({
  selector: 'app-layout-animation-test',
  imports: [
    PreHeaderComponent,
    FormsModule,
    NgOptimizedImage,
    ReactiveFormsModule,
    MatAutocompleteTrigger,
    MatButton,
    MatIcon,
    MatAutocomplete,
    MatOption,
    RouterLink,
    RouterOutlet
  ],
  standalone: true,
  templateUrl: './layout-animation-test.component.html',
  styleUrl: './layout-animation-test.component.css'
})
export class LayoutAnimationTestComponent implements OnInit {
  // injected services
  searchService = inject(SearchService);
  accService = inject(AccountService);
  dataService = inject(DataService);

  icons = {
    solid: {
      search: faSearch,
    }
  }

  // local signals
  public chainData = signal<ExplorerMetadata>({} as ExplorerMetadata);

  // shared signals
  // searchValue = this.searchService.searchQuery.asReadonly();
  $searchValue = toObservable(this.searchService.searchQuery);

  searchField = viewChild<ElementRef<HTMLInputElement>>('searchField');
  validSearch = signal<boolean>(false);

  filteredAccounts = signal<string[]>([]);

  searchForm: FormGroup;
  systemAccounts = ["eosio", "eosio.token", "eosio.msig"];
  searchPlaceholder = signal<string>("");

  autocomplete = viewChild(MatAutocompleteTrigger);

  private currentPlaceholder = 0;
  placeholders = [
    'Search by account name...',
    'Search by block number...',
    'Search by transaction id...',
    'Search by EVM hash...',
    'Search by public key...'
  ];

  err = signal("");

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.createScrollAnimation();
    }
  }

  constructor(private formBuilder: FormBuilder,
              private router: Router,
              @Inject(PLATFORM_ID) private platformId: Object) {

    this.initGsap();

    // afterNextRender(() => {
    //   this.initGsap();
    // });

    if (this.dataService.explorerMetadata) {
      this.chainData.set(this.dataService.explorerMetadata);
    }

    this.searchForm = this.formBuilder.group({
      search_field: ['', Validators.required]
    });

    this.searchPlaceholder.set(this.placeholders[0]);

    this.searchForm.get('search_field')?.valueChanges?.pipe(debounceTime(300))?.subscribe((value) => {
      if (value && value.length > 2) {
        this.validSearch.set(this.searchService.submitSearch(value, []));

        if (this.validSearch()) {
          console.log(`Searching by ${this.searchService.searchType()}... (${this.searchService.searchQuery()})`);
        }

        this.searchService.filterAccountNames(value).then((filteredAccounts: string[]) => {
          if (filteredAccounts.length === 0) {
            this.filteredAccounts.set(this.systemAccounts.filter(acct => acct.startsWith(value)));
          } else {
            this.filteredAccounts.set(filteredAccounts);
          }
        });
      } else {
        this.validSearch.set(false);
        this.closeAutoComplete();
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

  closeAutoComplete() {
    console.log('Closing autocomplete...');
    this.filteredAccounts.set([]);
    this.autocomplete()?.closePanel();
  }

  async submit(): Promise<void> {
    if (!this.searchForm.valid) {
      this.err.set("Please input something above!");
      return;
    }
    const searchText = this.searchForm.get('search_field')?.value;
    if (searchText) {
      this.searchForm.reset();
      this.closeAutoComplete();
      const status = this.searchService.submitSearch(searchText, this.filteredAccounts());
      if (!status) {
        this.err.set('no results for ' + searchText);
      } else {
        this.err.set("");
        await this.router.navigateByUrl(`/${this.searchService.searchType()}/${this.searchService.searchQuery()}`);
        // this.setupHeaderTransition();
      }
    }
  }

  initGsap() {
    gsap.registerPlugin(ScrollTrigger);
    // ScrollTrigger.normalizeScroll(true);
  }

  private createScrollAnimation() {
    const headerContainer = document.querySelector('#header-container');
    const logo = document.querySelector('#logo-element') as HTMLDivElement;
    const searchBar = document.querySelector('#search-bar') as HTMLDivElement;
    const contentContainer = document.querySelector('#content-container') as HTMLDivElement;

    if (!headerContainer || !logo || !searchBar || !contentContainer) {
      return;
    }

    gsap.set(contentContainer, {paddingTop: `${headerContainer.clientHeight + 30}px`});

    const logoGap = 10;

    const scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: headerContainer,
        start: 'top top',
        end: '300px 100px',
        scrub: true,
        markers: false,
        snap: 1,
        onEnterBack: () => {
          // gsap.set('#account-name-sticky', {position: 'fixed'});
        },
        onLeave: () => {
          // gsap.set('#account-name-sticky', {position: 'sticky'});
        },
        onUpdate: (self) => {

          // if (contentContainer && contentContainer.style && headerContainer) {
          //   // contentContainer.style.paddingTop = `${headerContainer.clientHeight + 30}px`;
          // }

          // update the logo size to match the search bar height
          //interpolate the logo height from 4.375rem to 2.625rem along the animation progress from 0 to 1
          const logoHeight = 4.375 - (1.75 * self.progress);
          logo.style.height = `${logoHeight}rem`;



          // make it vertically centered with the search bar
          let deltaX = searchBar.offsetLeft - logo.offsetLeft - logo.clientWidth - logoGap;

          console.log(window.innerWidth, deltaX, logo.offsetLeft);

          if (self.progress <= 0.5) {
            const gap = (1 - self.progress * 2) * logoGap;
            logo.style.top = `calc(-${gap}px + ((50% + ${logo.clientHeight / 2}px) * ${self.progress * 2}))`;
            logo.style.transform = `translateX(${(deltaX * self.progress * 2)}px) translateY(-${logo.clientHeight + gap}px)`;
          } else {
            logo.style.top = `0px`;
            logo.style.transform = `translateX(${deltaX}px) translateY(0px)`;
          }
        }
      }
    });

    // set initial opacity to 1
    const gap = (1 - (0)) * logoGap;
    const deltaY = logo.clientHeight + gap;
    gsap.set(logo, {
      borderRadius: "10px",
      opacity: 0,
      transform: `translateX(0px) translateY(-${deltaY}px)`,
    });
    gsap.to(logo, {
      opacity: 1,
      duration: 0.2
    });
    gsap.to(searchBar, {opacity: 1, duration: 0.5});

    scrollTimeline.to('.tagline', {
      xPercent: '-100',
      opacity: 0,
      width: 0,
      duration: 0.5,
    });
    scrollTimeline.to(logo, {borderRadius: "30px", duration: 0.5}, 0);
    scrollTimeline.to(searchBar, {height: '2.625rem'}, 0);
    scrollTimeline.to(headerContainer, {height: '6.438rem', duration: 0.5}, 0);
  }
}
