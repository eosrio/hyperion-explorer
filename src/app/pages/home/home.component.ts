import {
  afterNextRender,
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
import {isPlatformBrowser, NgClass, NgOptimizedImage, NgStyle} from "@angular/common";
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
import {ActivatedRoute, Router, RouterLink, RouterOutlet} from "@angular/router";
import {debounceTime} from "rxjs";
import {AccountService} from "../../services/account.service";
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {ScrollToPlugin} from 'gsap/ScrollToPlugin';
import {toObservable} from "@angular/core/rxjs-interop";

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
    RouterOutlet,
    NgClass,
    RouterLink,
    NgStyle
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
  $searchValue = toObservable(this.searchValue);
  searchType = this.searchService.searchType.asReadonly();
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

  constructor(
    private dataService: DataService,
    private formBuilder: FormBuilder,
    private searchService: SearchService,
    public accService: AccountService,
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

      // get the current route
      this.$searchValue.subscribe((value) => {
        if (value) {
          this.setupHeaderTransition();
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
          this.filteredAccounts.set(filteredAccounts
            .concat(this.systemAccounts.filter(acct => acct.startsWith(value)))
            .sort((a, b) => a.localeCompare(b))
          );
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
    if (this.autocomplete()) {
      const ref = this.autocomplete();
      if (ref !== undefined) {
        ref.closePanel();
      }
    }
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
        await this.router.navigateByUrl(`/${this.searchType()}/${this.searchValue()}`);
        this.setupHeaderTransition();
      }
    }
  }

  private createAbsoluteClone(target: HTMLElement, container: HTMLElement, className: string): HTMLElement {
    const clone = target.cloneNode(true) as HTMLElement;
    const rect = target.getBoundingClientRect();
    clone.classList.add(className);
    clone.style.position = 'absolute';
    clone.style.zIndex = '1000';
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    container.appendChild(clone);
    target.style.visibility = 'hidden';
    return clone;
  }

  private setupHeaderTransition() {

    if (this.headerTransitionConfigured) {
      return;
    }

    this.headerTransitionConfigured = true;

    console.log('Setting up header transition...');

    gsap.registerPlugin(ScrollTrigger);
    gsap.registerPlugin(ScrollToPlugin)

    const animationCanvas = document.querySelector('.animation-canvas') as HTMLElement;
    const hyperionLogo = document.querySelector('.compact-hyperion-branding') as HTMLElement;
    const compactLogo = document.querySelector('.compact-logo') as HTMLElement;
    const mainLogo = document.querySelector('.main-chain-logo') as HTMLElement;
    const mainFormContainer = document.querySelector('.main-form-container') as HTMLElement;
    const compactFormContainer = document.querySelector('.compact-form-container') as HTMLElement;

    if (!mainLogo || !compactLogo || !animationCanvas || !mainFormContainer || !compactFormContainer || !hyperionLogo) {
      return;
    }

    // Chain Logo
    const mainLogoRect = mainLogo.getBoundingClientRect();
    const compactLogoRect = compactLogo.getBoundingClientRect();

    // Form Container
    const compactFormContainerRect = compactFormContainer.getBoundingClientRect();

    this.createAbsoluteClone(mainLogo, animationCanvas, 'animated-logo');
    this.createAbsoluteClone(mainFormContainer, animationCanvas, 'animated-form-container');

    // this.createAbsoluteClone(hyperionLogo, animationCanvas, 'animated-hyperion-branding');

    const yScaleFactor = compactLogoRect.height / mainLogoRect.height;
    const widthDiff = compactLogoRect.width - mainLogoRect.width;
    const heightDiff = compactLogoRect.height - mainLogoRect.height;

    const revealCompactTimeline = gsap.timeline({
      scrollTrigger: {
        scrub: 0.2,
        trigger: '.header-card',
        start: 'bottom 160px',
        end: 'bottom 50px',
        id: 'reveal-transition',
        markers: false
      }
    });

    revealCompactTimeline.to('.compact-header-container', {
      opacity: 1,
      duration: 2,
      ease: 'power3'
    });

    revealCompactTimeline.to('.animated-form-container', {
      opacity: 0,
      duration: 0.5,
      ease: 'power3'
    }, "<");

    revealCompactTimeline.to('.animated-logo', {
      opacity: 0,
      duration: 2,
      ease: 'power3'
    }, "<");

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: '.header-card',
        scrub: true,
        start: 'top top',
        end: '250px 88px',
        id: 'header-transition',
        pin: false,
        markers: false
      }
    });

    timeline.to('.animated-logo', {
      left: compactLogoRect.left + (widthDiff / 2) - 4,
      top: compactLogoRect.top + heightDiff / 2,
      scale: yScaleFactor,
      duration: 0.7,
      ease: 'power2.out'
    }, 0);

    // timeline.to('.animated-hyperion-branding', {
    //   opacity: 1,
    //   duration: 1
    // }, 0);

    timeline.to('.animated-form-container', {
      left: () => {
        return compactFormContainer.getBoundingClientRect().left || 0;
      },
      height: compactFormContainerRect.height,
      width: compactFormContainerRect.width,
      top: compactFormContainerRect.top,
      duration: 0.6,
      ease: 'power2.out'
    }, 0);

    // timeline.play();
    // revealCompactTimeline.play();

    setTimeout(() => {
      gsap.to(window, {
        duration: 1,
        ease: "power2.out",
        scrollTo: {
          y: 200,
          autoKill: true
        },
        onComplete: () => {
          console.log('Scrolled to 200');
        }
      });
    }, 500);

  }
}
