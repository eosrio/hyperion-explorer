import {Component, ElementRef, HostListener, inject, OnInit, PLATFORM_ID, signal, viewChild} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {isPlatformBrowser, NgOptimizedImage} from "@angular/common";
import {SearchService} from "../../services/search.service";
import {DataService} from "../../services/data.service";
import {faHeart, faSearch} from "@fortawesome/free-solid-svg-icons";
import {ExplorerMetadata} from "../../interfaces";
import {MatAutocomplete, MatAutocompleteTrigger, MatOption} from "@angular/material/autocomplete";
import {Router, RouterLink, RouterOutlet} from "@angular/router";
import {debounceTime, map} from "rxjs";
import {MatButton} from "@angular/material/button";

import {version as PackageVersion} from '../../../../package.json';
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {LayoutTransitionComponent} from "../../components/layout-transition/layout-transition.component";
import {animate, scroll} from "motion";
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {ThemeSelectorComponent} from "../../components/theme-selector/theme-selector.component";
import {faGithub, faTelegram} from "@fortawesome/free-brands-svg-icons";


@Component({
  selector: 'app-layout-animation-test',
  imports: [
    FormsModule,
    NgOptimizedImage,
    ReactiveFormsModule,
    MatAutocompleteTrigger,
    MatButton,
    MatAutocomplete,
    MatOption,
    RouterOutlet,
    FaIconComponent,
    LayoutTransitionComponent,
    RouterLink,
    ThemeSelectorComponent
  ],
  templateUrl: './main-search.component.html',
  styleUrl: './main-search.component.css'
})
export class MainSearchComponent implements OnInit {
  // injected services
  breakpointObserver = inject(BreakpointObserver);
  searchService = inject(SearchService);
  dataService = inject(DataService);
  formBuilder = inject(FormBuilder);
  platformId = inject(PLATFORM_ID);
  router = inject(Router);

  // get version from package.json
  version = PackageVersion;

  // fontawesome icons
  icons = {
    solid: {
      search: faSearch,
      heart: faHeart
    },
    brand: {
      github: faGithub,
      telegram: faTelegram
    }
  }

  chainData = signal<ExplorerMetadata>({} as ExplorerMetadata);
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
    // 'Search by EVM hash...',
    'Search by public key...'
  ];

  err = signal("");

  taglineMax = 145;
  paddingMax = 1;
  transitionProgress = signal<number>(0);
  taglineWidth = signal(this.taglineMax);
  searchInputPadding = signal(this.paddingMax);

  showThemeSelector = signal(false);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // this.createScrollAnimation();
      this.createMotionAnimation();
    }
    if (this.dataService.routeError) {
      this.err.set(this.dataService.routeError);
      this.dataService.routeError = '';
    }
  }

  constructor() {

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

    // TODO: temporarily disabled
    // if (isPlatformBrowser(this.platformId)) {
    //   setInterval(() => {
    //     this.currentPlaceholder++;
    //     if (!this.placeholders[this.currentPlaceholder]) {
    //       this.currentPlaceholder = 0;
    //     }
    //     this.searchPlaceholder.set(this.placeholders[this.currentPlaceholder]);
    //   }, 2000);
    // }

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
      const trimmedText = searchText.trim();
      this.searchForm.reset();
      this.closeAutoComplete();
      const status = this.searchService.submitSearch(trimmedText, this.filteredAccounts());
      if (!status) {
        this.err.set('no results for ' + trimmedText);
      } else {
        this.err.set("");
        await this.router.navigateByUrl(`/${this.searchService.searchType()}/${this.searchService.searchQuery()}`);
      }
    }
  }

  private createMotionAnimation() {
    const headerContainer = document.querySelector('#header-container') as HTMLDivElement;
    const contentContainer = document.querySelector('#content-container') as HTMLDivElement;

    if (!headerContainer || !contentContainer) {
      return;
    }

    animate([
      [contentContainer, {
        paddingTop: `${headerContainer.clientHeight + 30}px`,
        // paddingBottom: `${headerContainer.clientHeight}px`
      }],
    ]);

    scroll(
      (progress: any) => {
        // console.log(`scrolling`, progress);
        this.transitionProgress.set(progress);
        this.taglineWidth.set(this.taglineMax - (progress * this.taglineMax));
        this.searchInputPadding.set((this.paddingMax * (1 - progress)) + (0.75 * progress));
      },
      {target: headerContainer, offset: ['start start', '300px 100px']}
    );


    scroll(animate('.tagline', {x: [0, -100], opacity: [1, 0]}, {duration: 1}),
      {target: headerContainer, offset: ['start start', '300px 100px']}
    );

    let headerAnimation: any | null = null;
    let scrollConfigured = false;

    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((result) => result.matches))
      .subscribe((isSmall) => {

        if (headerAnimation) {
          headerAnimation.stop();
        }

        headerAnimation = animate(headerContainer, {
          height: [
            '20.875rem', // Initial height
            isSmall ? '9.5rem' : '6.7rem' // Final height
          ]
        }, {ease: "easeIn", duration: 1, autoplay: false});

        if (!scrollConfigured) {
          scrollConfigured = true;
          scroll((p: number) => {
            // console.log(`scrolling`, p);
            if (headerAnimation) {
              headerAnimation.time = p;
            }
          }, {
            target: headerContainer,
            offset: ['start start', '300px 100px'],
          });
        }

        // scroll(headerAnimation, {
        //   target: headerContainer,
        //   offset: ['start start', '300px 100px'],
        // });

      });
  }
}
