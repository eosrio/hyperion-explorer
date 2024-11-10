import {
  afterNextRender,
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener, inject,
  Inject,
  PLATFORM_ID,
  signal,
  viewChild
} from '@angular/core';
import {PreHeaderComponent} from "../../components/pre-header/pre-header.component";
import {isPlatformBrowser, NgOptimizedImage, NgStyle} from "@angular/common";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {faHeart, faSearch} from "@fortawesome/free-solid-svg-icons";
import {SearchService} from "../../services/search.service";
import {MatAutocomplete, MatAutocompleteTrigger, MatOption} from "@angular/material/autocomplete";
import {MatButton} from "@angular/material/button";
import {DataService} from "../../services/data.service";
import {ExplorerMetadata} from "../../interfaces";
import {MatIcon} from "@angular/material/icon";
import {ActivatedRoute, Router, RouterLink, RouterOutlet} from "@angular/router";
import {debounceTime} from "rxjs";
import {AccountService} from "../../services/account.service";
import {toObservable} from "@angular/core/rxjs-interop";
import {gsap} from 'gsap';
import {ScrollTrigger} from "gsap/ScrollTrigger";
import {ScrollToPlugin} from "gsap/ScrollToPlugin";
import {Flip} from "gsap/Flip";

@Component({
  selector: 'app-home',
  imports: [
    PreHeaderComponent,
    NgOptimizedImage,
    ReactiveFormsModule,
    MatAutocomplete,
    MatOption,
    MatAutocompleteTrigger,
    MatButton,
    MatIcon,
    RouterOutlet,
    RouterLink,
    NgStyle
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  standalone: true
})
export class HomeComponent {

  // injected services
  searchService = inject(SearchService);
  accService = inject(AccountService);
  dataService = inject(DataService);

  icons = {
    solid: {
      search: faSearch,
      heart: faHeart
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

  emptySearchError = signal(false);

  headerTransitionConfigured = false;

  isHome = signal(true);
  private headerContainerTimeline?: gsap.core.Timeline;
  private mainLogoTimeline?: gsap.core.Timeline;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {

    if (isPlatformBrowser(this.platformId)) {
      console.log('Platform is browser');
      console.log(window.location.pathname);
      window.scrollTo(0, 0);
      if (window.location.pathname !== '/') {
        // prevent the header transition from being set up
        // this.headerTransitionConfigured = true;
        this.isHome.set(true);
      } else {
        this.isHome.set(true);
      }
    }

    afterNextRender(() => {

      this.setupHeaderTransition();

      // get the current route
      this.$searchValue.subscribe((value) => {
        if (value) {
          // this.setupHeaderTransition();
        }
      });
    });


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

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    if (isPlatformBrowser(this.platformId)) {
      if (this.headerContainerTimeline && this.mainLogoTimeline) {

        this.headerContainerTimeline.revert();
        this.mainLogoTimeline.revert();
        Flip.killFlipsOf('#header-card, #account-name-sticky, .custom-card, #content, .header-flip');
      }

      this.setupTriggers();
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

  setupTriggers() {
    // if (this.headerTransitionConfigured) {
    //   return;
    // }
    // this.headerTransitionConfigured = true;

    const headerContainerState = Flip.getState('#header-card, #account-name-sticky, .custom-card, #content', {props: 'height'});
    const mainLogoState = Flip.getState('.header-flip', {props: 'height'});
    const logo = document.querySelector('#main-logo') as HTMLElement;
    const tagline = document.querySelector('.tagline') as HTMLElement;
    const searchbarContainer = document.querySelector('#searchbar-container') as HTMLElement;
    const logoNewContainer = document.querySelector('.logo-empty-space') as HTMLDivElement;
    const searchbarNewContainer = document.querySelector('.searchbar-empty-space') as HTMLDivElement;
    const headerCard = document.querySelector('#header-card') as HTMLElement;
    if (!logo || !logoNewContainer || !headerCard) {
      return;
    }
    logoNewContainer.replaceChildren(logo);
    searchbarNewContainer.replaceChildren(searchbarContainer);
    logo.style.height = '2.625rem';
    headerCard.style.height = 'auto';
    headerCard.style.top = '0';
    tagline.style.width = '0';
    tagline.style.opacity = '0';

    this.headerContainerTimeline = Flip.from(headerContainerState, {
      duration: 0.5,
      paused: true,
      ease: 'power2.out',
      absolute: false,
      onComplete: () => {
        console.log('Header Flipped');
      },
      scrollTrigger: {
        trigger: '.header-card',
        start: 'top 0',
        end: 'bottom 40px',
        scrub: true,
        markers: false,
      }
    });

    this.mainLogoTimeline = Flip.from(mainLogoState, {
      duration: 0.5,
      paused: true,
      nested: true,
      ease: 'power2.out',
      absolute: true,
      onComplete: () => {
        console.log('Flipped');
      },
      scrollTrigger: {
        trigger: '.header-card',
        start: 'top 0',
        end: 'bottom 40px',
        scrub: true,
        markers: false,
      }
    });

  }

  private setupHeaderTransition() {
    gsap.registerPlugin(Flip);
    gsap.registerPlugin(ScrollTrigger);
    gsap.registerPlugin(ScrollToPlugin);
    this.setupTriggers();
  }


  // private createAbsoluteClone(target: HTMLElement, container: HTMLElement, className: string): HTMLElement {
  //   const clone = target.cloneNode(true) as HTMLElement;
  //   const rect = target.getBoundingClientRect();
  //   clone.classList.add(className);
  //   clone.style.position = 'absolute';
  //   clone.style.zIndex = '1000';
  //   clone.style.left = `${rect.left}px`;
  //   clone.style.top = `${rect.top}px`;
  //   clone.style.width = `${rect.width}px`;
  //   clone.style.height = `${rect.height}px`;
  //   container.appendChild(clone);
  //   target.style.visibility = 'hidden';
  //   return clone;
  // }

  // private setupHeaderTransition() {
  //
  //   if (this.headerTransitionConfigured) {
  //     return;
  //   }
  //
  //   this.headerTransitionConfigured = true;
  //
  //   console.log('Setting up header transition...');
  //
  //   gsap.registerPlugin(ScrollTrigger);
  //   gsap.registerPlugin(ScrollToPlugin)
  //
  //   const animationCanvas = document.querySelector('.animation-canvas') as HTMLElement;
  //   const hyperionLogo = document.querySelector('.compact-hyperion-branding') as HTMLElement;
  //   const compactLogo = document.querySelector('.compact-logo') as HTMLElement;
  //   const mainLogo = document.querySelector('.main-chain-logo') as HTMLElement;
  //   const mainFormContainer = document.querySelector('.main-form-container') as HTMLElement;
  //   const compactFormContainer = document.querySelector('.compact-form-container') as HTMLElement;
  //
  //   if (!mainLogo || !compactLogo || !animationCanvas || !mainFormContainer || !compactFormContainer || !hyperionLogo) {
  //     return;
  //   }
  //
  //   // Chain Logo
  //   const mainLogoRect = mainLogo.getBoundingClientRect();
  //   const compactLogoRect = compactLogo.getBoundingClientRect();
  //
  //   // Form Container
  //   const compactFormContainerRect = compactFormContainer.getBoundingClientRect();
  //
  //   this.createAbsoluteClone(mainLogo, animationCanvas, 'animated-logo');
  //   this.createAbsoluteClone(mainFormContainer, animationCanvas, 'animated-form-container');
  //
  //   // this.createAbsoluteClone(hyperionLogo, animationCanvas, 'animated-hyperion-branding');
  //
  //   const yScaleFactor = compactLogoRect.height / mainLogoRect.height;
  //   const widthDiff = compactLogoRect.width - mainLogoRect.width;
  //   const heightDiff = compactLogoRect.height - mainLogoRect.height;
  //
  //   const revealCompactTimeline = gsap.timeline({
  //     scrollTrigger: {
  //       scrub: 0.2,
  //       trigger: '.header-card',
  //       start: 'bottom 160px',
  //       end: 'bottom 50px',
  //       id: 'reveal-transition',
  //       markers: false
  //     }
  //   });
  //
  //   revealCompactTimeline.to('.compact-header-container', {
  //     opacity: 1,
  //     duration: 2,
  //     ease: 'power3'
  //   });
  //
  //   revealCompactTimeline.to('.animated-form-container', {
  //     opacity: 0,
  //     duration: 0.5,
  //     ease: 'power3'
  //   }, "<");
  //
  //   revealCompactTimeline.to('.animated-logo', {
  //     opacity: 0,
  //     duration: 2,
  //     ease: 'power3'
  //   }, "<");
  //
  //   const timeline = gsap.timeline({
  //     scrollTrigger: {
  //       trigger: '.header-card',
  //       scrub: true,
  //       start: 'top top',
  //       end: '250px 88px',
  //       id: 'header-transition',
  //       pin: false,
  //       markers: false
  //     }
  //   });
  //
  //   timeline.to('.animated-logo', {
  //     left: compactLogoRect.left + (widthDiff / 2) - 4,
  //     top: compactLogoRect.top + heightDiff / 2,
  //     scale: yScaleFactor,
  //     duration: 0.7,
  //     ease: 'power2.out'
  //   }, 0);
  //
  //   // timeline.to('.animated-hyperion-branding', {
  //   //   opacity: 1,
  //   //   duration: 1
  //   // }, 0);
  //
  //   timeline.to('.animated-form-container', {
  //     left: () => {
  //       return compactFormContainer.getBoundingClientRect().left || 0;
  //     },
  //     height: compactFormContainerRect.height,
  //     width: compactFormContainerRect.width,
  //     top: compactFormContainerRect.top,
  //     duration: 0.6,
  //     ease: 'power2.out'
  //   }, 0);
  //
  //   // timeline.play();
  //   // revealCompactTimeline.play();
  //
  //   setTimeout(() => {
  //     gsap.to(window, {
  //       duration: 1,
  //       ease: "power2.out",
  //       scrollTo: {
  //         y: 200,
  //         autoKill: true
  //       },
  //       onComplete: () => {
  //         console.log('Scrolled to 200');
  //       }
  //     });
  //   }, 500);
  //
  // }
}
