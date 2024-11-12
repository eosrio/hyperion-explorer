import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild
} from '@angular/core';
import gsap from "gsap";
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {ScrollToPlugin} from "gsap/ScrollToPlugin";

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
import {Router, RouterOutlet} from "@angular/router";
import {debounceTime} from "rxjs";
import {MatButton} from "@angular/material/button";
import {MatIcon} from "@angular/material/icon";

import {version as PackageVersion} from '../../../../package.json';
import {FaIconComponent} from "@fortawesome/angular-fontawesome";


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
    RouterOutlet,
    FaIconComponent
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
  router = inject(Router);
  formBuilder = inject(FormBuilder);
  platformId = inject(PLATFORM_ID);

  // get version from package.json
  version = PackageVersion;

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

  headerExpanded = signal(true);
  private scrollTimeline?: gsap.core.Timeline;

  globalWidth = signal(0);
  $globalWidth = toObservable(this.globalWidth).pipe(debounceTime(200));
  private isResizing = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.createScrollAnimation();
    }
  }

  constructor() {

    this.initGsap();

    this.$globalWidth.subscribe((width) => {
      this.debouncedResize(width);
    });

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
    gsap.registerPlugin(ScrollToPlugin);
  }

  private createScrollAnimation() {

    const headerContainer = document.querySelector('#header-container');
    const logo = document.querySelector('#logo-element') as HTMLDivElement;
    const searchBar = document.querySelector('#search-bar') as HTMLDivElement;
    const contentContainer = document.querySelector('#content-container') as HTMLDivElement;

    if (!headerContainer || !logo || !searchBar || !contentContainer) {
      return;
    }

    gsap.set(contentContainer, {
      paddingTop: `${headerContainer.clientHeight + 30}px`,
      paddingBottom: `${headerContainer.clientHeight}px`
    });

    const logoGap = 10;

    const scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: headerContainer,
        start: 'top top',
        end: '300px 100px',
        scrub: true,
        // markers: true,
        snap: {snapTo: 1, duration: 0.5, ease: 'linear'},
        onLeaveBack: () => {
          this.headerExpanded.set(true);
        },
        onLeave: () => {
          // gsap.set('#account-name-sticky', {position: 'sticky'});
          this.headerExpanded.set(false);
          if (!this.isResizing) {
            // this.resizeHeader();
          }
        }
      },
    });

    // set initial opacity to 1
    const gap = (1 - (0)) * logoGap;
    const deltaY = logo.clientHeight + gap;

    gsap.set(logo, {
      borderRadius: "10px",
      opacity: 0,
      x: 0,
      y: -deltaY,
      // transform: `translateX(0px) translateY(-${deltaY}px)`,
    });

    // fade in the logo and search bar
    gsap.to(logo, {opacity: 1, duration: 0.2});
    gsap.to(searchBar, {opacity: 1, duration: 0.5});

    const logoInitialHeight = 4.375;
    const logoFinalHeight = logoInitialHeight - 1.75;
    const logoScale = logoFinalHeight / logoInitialHeight;


    // animate the tagline out
    scrollTimeline.to('.tagline', {xPercent: '-100', opacity: 0, width: 0, duration: 0.5}, 0);
    scrollTimeline.to(headerContainer, {height: '6.438rem', duration: 0.5}, 0);

    const logoRect = logo.getBoundingClientRect();
    const hyperionLogo = (document.querySelector('.logo-name') as HTMLDivElement).getBoundingClientRect();
    const dataProviderElement = (document.querySelector('.provider') as HTMLDivElement).getBoundingClientRect();

    const leftMargin = hyperionLogo.right;
    const rightMargin = window.innerWidth - dataProviderElement.left;
    const sideMargin = Math.max(leftMargin, rightMargin);

    const finalSearchBarWidth = window.innerWidth - (sideMargin * 2) - ((logoRect.width + logoGap) * 2);

    const finalLogoWidth = logoRect.width * logoScale;
    const deltaX = -(window.innerWidth / 2) - (finalLogoWidth / 2) + ((window.innerWidth - finalSearchBarWidth) / 2) - logoGap;

    // calculate how much both the logo and search bar need to move to the center
    const totalFinalWidth = finalLogoWidth + finalSearchBarWidth + (logoGap * 2);
    const remainingSpace = window.innerWidth - totalFinalWidth;
    const alignmentOffset = (remainingSpace / 2) - sideMargin;

    scrollTimeline.to(searchBar, {
      height: '2.625rem',
      width: finalSearchBarWidth + alignmentOffset,
      x: alignmentOffset / 2
    }, 0);

    scrollTimeline.to(logo, {
      duration: 0.5,
      height: `${logoFinalHeight}rem`,
      x: deltaX,
      y: 0,
      onComplete: () => {
        // this.resizeHeader();
      }
    }, 0);

    this.scrollTimeline = scrollTimeline;
  }

  // resize event listener
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.globalWidth.set(window.innerWidth);
  }

  private debouncedResize(width: number) {
    if (!this.scrollTimeline || this.isResizing) {
      return;
    }
    if (!this.headerExpanded()) {
      console.log('Resizing compact header...');
      this.isResizing = true;

      // kill the scroll timeline if the window is resized
      this.scrollTimeline.kill();

      const headerContainer = (document.querySelector('#header-container') as HTMLDivElement);
      const contentContainer = document.querySelector('#content-container') as HTMLDivElement;

      // reset the padding top of the content container
      gsap.set(contentContainer, {paddingTop: `${headerContainer.clientHeight + 30}px`});

      this.resizeHeader();

    } else {
      console.log('Resizing expanded header...');
      // this.scrollTimeline.pause(0);
    }
  }

  resizeHeader() {
    const logoElement = document.querySelector('#logo-element') as HTMLDivElement;
    const searchBar = (document.querySelector('#search-bar') as HTMLDivElement).getBoundingClientRect();
    const logo = logoElement.getBoundingClientRect();
    const hyperionLogo = (document.querySelector('.logo-name') as HTMLDivElement).getBoundingClientRect();
    const dataProviderElement = (document.querySelector('.provider') as HTMLDivElement).getBoundingClientRect();
    const sideMargin = Math.max(hyperionLogo.right, (window.innerWidth - dataProviderElement.left)) + 10;
    const currentTotalWidth = searchBar.width + logo.width + 20;
    const availableWidth = window.innerWidth - (sideMargin * 2);

    const timeline = gsap.timeline({
      onComplete: () => {
        this.isResizing = false;
      }
    });

    // move the logo to the left
    timeline.to(logoElement, {
      x: "+=" + (sideMargin - logo.left),
      duration: 0.3,
      ease: "power3.out"
    })

    // resize the search bar
    timeline.to('#search-bar', {
      width: (searchBar.width + (availableWidth - currentTotalWidth)),
      duration: 0.3,
      ease: "power3.out"
    });
  }
}
