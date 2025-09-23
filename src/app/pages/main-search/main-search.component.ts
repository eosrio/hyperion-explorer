import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
  afterNextRender,
  OnDestroy, // Added import
  linkedSignal
} from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { CommonModule, isPlatformBrowser, NgOptimizedImage } from "@angular/common";
import { SearchService } from "../../services/search.service";
import { DataService } from "../../services/data.service";
import { faHeart, faSearch } from "@fortawesome/free-solid-svg-icons";
import { ExplorerMetadata } from "../../interfaces";
import { MatAutocomplete, MatAutocompleteTrigger, MatOption } from "@angular/material/autocomplete";
import { Router, RouterLink, RouterOutlet } from "@angular/router";
import { debounceTime, map, Subscription } from "rxjs"; // Added Subscription import
import { MatButton } from "@angular/material/button";

import { version as PackageVersion } from '../../../../package.json';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { LayoutTransitionComponent } from "../../components/layout-transition/layout-transition.component";
// Import AnimationControls and ensure animate/scroll are imported
import { animate, scroll } from "motion"; // Removed AnimationControls import
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { ThemeSelectorComponent } from "../../components/theme-selector/theme-selector.component";
import { faGithub, faTelegram } from "@fortawesome/free-brands-svg-icons";


@Component({
  selector: 'app-layout-animation-test', // Note: Selector might be better as 'app-main-search'
  standalone: true, // Assuming standalone based on modern practices
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
    ThemeSelectorComponent,
    CommonModule
  ],
  templateUrl: './main-search.component.html',
  styleUrl: './main-search.component.css'
})
export class MainSearchComponent implements OnInit, OnDestroy { // Implemented OnDestroy
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

  chainData = linkedSignal<ExplorerMetadata>(() => {
    const data = this.dataService.explorerMetadata();
    if (data) {
      return data;
    } else {
      return {} as ExplorerMetadata;
    }
  });
  searchField = viewChild<ElementRef<HTMLInputElement>>('searchField');
  validSearch = signal<boolean>(false);
  filteredAccounts = signal<string[]>([]);

  searchForm: FormGroup;
  systemAccounts = ["eosio", "eosio.token", "eosio.msig"];
  // Signal for the full placeholder (for backward compatibility)
  searchPlaceholder = signal<string>("");

  // Signal for the dynamic part of the placeholder (for the animation)
  dynamicPlaceholder = signal<string>("");

  autocomplete = viewChild(MatAutocompleteTrigger);

  private currentPlaceholder = 0;

  // Static part of the placeholder
  private staticPlaceholderText = 'Search by';

  // Dynamic parts of the placeholder (without the static part)
  placeholders = [
    ' account name...',
    ' block number...',
    ' transaction id...',
    // 'EVM hash...',
    ' public key...'
  ];

  private placeholderInterval: any = null;
  // Scramble animation state
  private scrambleFrame: number | null = null;
  private scrambleQueue: Array<{ from: string; to: string; start: number; end: number; ch?: string }> = [];
  private scrambleStartTime = 0;
  private readonly scrambleDuration = 600; // ms (faster)
  // Restrict to lowercase alpha to match placeholder style
  private readonly scrambleChars = 'abcdefghijklmnopqrstuvwxyz';

  err = signal("");

  taglineMax = 145;
  paddingMax = 1;
  transitionProgress = signal<number>(0);
  taglineWidth = signal(this.taglineMax);
  searchInputPadding = signal(this.paddingMax);

  showThemeSelector = signal(false);

  // Required scroll distance for the animation (in pixels)
  private readonly requiredScrollDistance = 100;

  // Store animation controls
  private taglineScrollControl: any | null = null; // Changed type to any
  private taglineOpacityScrollControl: any | null = null; // Changed type to any
  private headerAnimation: any | null = null; // Promoted to class property
  private headerScrollCleanup: (() => void) | null = null; // To store scroll cleanup
  private breakpointSubscription: Subscription | null = null; // To store breakpoint observer subscription

  constructor() {

    this.searchForm = this.formBuilder.group({
      search_field: ['', Validators.required]
    });

    // Set both the full placeholder and the dynamic part
    this.dynamicPlaceholder.set(this.placeholders[0]);
    this.searchPlaceholder.set(this.staticPlaceholderText + this.placeholders[0]);

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

    // Initialize transition progress after view renders (browser only)
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.updateTransitionProgress(); // Initial call
      });
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.createMotionAnimation(); // Keep other setup animations
      this.startPlaceholderAnimation(); // Start placeholder animation
    }
    if (this.dataService.routeError) {
      this.err.set(this.dataService.routeError);
      this.dataService.routeError = '';
    }
  }

  private startPlaceholderAnimation(): void {

    // Reset to the first placeholder to ensure we start from the beginning
    this.currentPlaceholder = 0;
    
    // Set both the full placeholder and the dynamic part
    this.dynamicPlaceholder.set(this.placeholders[0]);
    this.searchPlaceholder.set(this.staticPlaceholderText + this.placeholders[0]);

    // Trigger the first animation immediately
    setTimeout(() => {
      this.animatePlaceholder();
    }, 1000);

    // Start the animation loop with a 3-second interval
    this.placeholderInterval = setInterval(() => {
      this.animatePlaceholder();
    }, 3000);
  }

  private animatePlaceholder(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const inputElement = this.searchField()?.nativeElement;
    if (!inputElement) return;

    // Fixed sequence so all placeholders are shown
    const sequence = [0, 1, 2, 3];
    let nextIndex = sequence.indexOf(this.currentPlaceholder);
    if (nextIndex === -1) nextIndex = 0;
    const nextPlaceholder = sequence[(nextIndex + 1) % sequence.length];

    const targetText = this.placeholders[nextPlaceholder];

    // If input focused, set instantly and cancel any running scramble
    if (document.activeElement === inputElement) {
      this.cancelScramble();
      this.currentPlaceholder = nextPlaceholder;
      this.dynamicPlaceholder.set(targetText);
      this.searchPlaceholder.set(this.staticPlaceholderText + targetText);
      return;
    }

    // Start scramble from current displayed dynamic text
    const fromText = this.dynamicPlaceholder();
    this.currentPlaceholder = nextPlaceholder;
    this.startScramble(fromText, targetText);
  }

  // Begin a text scramble from 'fromText' to 'toText'
  private startScramble(fromText: string, toText: string): void {
    this.cancelScramble();
    const maxLen = Math.max(fromText.length, toText.length);
    this.scrambleQueue = [];
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.scrambleStartTime = now;

    for (let i = 0; i < maxLen; i++) {
      const fromCh = fromText[i] ?? ' ';
      const toCh = toText[i] ?? ' ';
      const same = fromCh === toCh;
      const isAlnum = /[A-Za-z0-9]/.test(toCh);

      if (same || !isAlnum) {
        // No scramble for identical or non-alphanumeric targets (spaces, punctuation)
        this.scrambleQueue.push({ from: fromCh, to: toCh, start: 0, end: 0 });
      } else {
        // Left-to-right stagger with a bit more emphasis and jitter for a clearer wave
        const progress = maxLen > 1 ? i / (maxLen - 1) : 0;
        const start = progress * (this.scrambleDuration * 0.7) + Math.random() * (this.scrambleDuration * 0.08);
        const end = start + (this.scrambleDuration * (0.28 + Math.random() * 0.18)); // keep window similar
        this.scrambleQueue.push({ from: fromCh, to: toCh, start, end });
      }
    }

    const frame = () => {
      const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.scrambleStartTime;
      let output = '';
      let complete = 0;
      for (let i = 0; i < this.scrambleQueue.length; i++) {
        const item = this.scrambleQueue[i];
        if (t >= item.end) {
          complete++;
          output += item.to;
        } else if (t >= item.start) {
          // Bias towards the correct character as we approach 'end'
          const span = Math.max(1, item.end - item.start);
          const local = Math.max(0, Math.min(1, (t - item.start) / span)); // 0..1

          // Probability to show the final char increases with local progress
          const showTargetProb = 0.15 + local * 0.75; // 15% -> 90%
          const flipProb = 0.12 * (1 - local); // taper random flips near completion

          if (Math.random() < showTargetProb) {
            output += item.to;
          } else {
            if (!item.ch || Math.random() < flipProb) {
              item.ch = this.randomScrambleChar();
            }
            output += item.ch;
          }
        } else {
          output += item.from;
        }
      }

      this.dynamicPlaceholder.set(output);
      this.searchPlaceholder.set(this.staticPlaceholderText + output);

      if (complete === this.scrambleQueue.length) {
        this.cancelScramble();
        // Ensure final text is exact
        this.dynamicPlaceholder.set(toText);
        this.searchPlaceholder.set(this.staticPlaceholderText + toText);
        return;
      }
      this.scrambleFrame = requestAnimationFrame(frame);
    };

    this.scrambleFrame = requestAnimationFrame(frame);
  }

  private randomScrambleChar(): string {
    return this.scrambleChars[Math.floor(Math.random() * this.scrambleChars.length)];
  }

  private cancelScramble(): void {
    if (this.scrambleFrame != null) {
      cancelAnimationFrame(this.scrambleFrame);
      this.scrambleFrame = null;
    }
    this.scrambleQueue = [];
  }

  ngOnDestroy(): void {
    // Stop and clear tagline animations
    this.taglineScrollControl?.stop();
    this.taglineScrollControl = null;
    this.taglineOpacityScrollControl?.stop();
    this.taglineOpacityScrollControl = null;

    // Stop and clear header animation
    this.headerAnimation?.stop();
    this.headerAnimation = null;

    // Call the cleanup function returned by the scroll listener for the header
    this.headerScrollCleanup?.();
    this.headerScrollCleanup = null;

    // Clear the placeholder animation interval
    if (this.placeholderInterval) {
      clearInterval(this.placeholderInterval);
      this.placeholderInterval = null;
    }

    // Cancel any running text scramble frames
    this.cancelScramble();

    // Unsubscribe from breakpoint observer
    this.breakpointSubscription?.unsubscribe();
    this.breakpointSubscription = null;
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

  // Update transition progress on scroll
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.updateTransitionProgress();
  }

  // If the user focuses the input while scrambling, stop immediately
  @HostListener('window:focusin', ['$event'])
  onFocusIn(event: FocusEvent): void {
    const inputEl = this.searchField()?.nativeElement;
    if (inputEl && event.target === inputEl) {
      this.cancelScramble();
      const targetText = this.placeholders[this.currentPlaceholder] ?? '';
      this.dynamicPlaceholder.set(targetText);
      this.searchPlaceholder.set(this.staticPlaceholderText + targetText);
    }
  }

  // Update transition progress and header animation on resize
  @HostListener('window:resize', [])
  onWindowResize(): void {
    this.updateTransitionProgress();

    // Update header animation to maintain correct height based on current scroll position
    if (this.headerAnimation && this.headerScrollCleanup) {
      const scrollY = window.scrollY;
      const headerContainer = document.querySelector('#header-container') as HTMLDivElement;
      if (headerContainer) {
        // Calculate progress based on the same offset used in the scroll animation
        // The offset is defined as ['start start', '300px 100px']
        // This means the animation starts when the top of the header reaches the top of the viewport
        // and ends when the top of the header is 300px below the top of the viewport
        const headerRect = headerContainer.getBoundingClientRect();
        const viewportTop = 0;
        const startProgress = headerRect.top <= viewportTop ? 0 : -1; // -1 means not started
        const endProgress = 1;
        const maxScrollDistance = 300; // From the offset definition

        let progress = 0;
        if (startProgress >= 0) {
          // If we've started the animation, calculate the progress
          progress = Math.min(endProgress, Math.max(startProgress, scrollY / maxScrollDistance));
        }

        // Update the animation time to match the current scroll progress
        this.headerAnimation.time = progress;
      }
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

  private updateTransitionProgress(): void {
    if (isPlatformBrowser(this.platformId)) {
      const availableScrollDistance = document.documentElement.scrollHeight - window.innerHeight;
      const currentScrollY = window.scrollY;
      const headerContainer = document.querySelector('#header-container') as HTMLDivElement; // Needed for target

      // Calculate main transition progress (used by LayoutTransitionComponent)
      if (availableScrollDistance < this.requiredScrollDistance) {
        this.transitionProgress.set(0);
      } else {
        const progress = Math.min(1, Math.max(0, currentScrollY / this.requiredScrollDistance));
        this.transitionProgress.set(progress);
      }

      // Determine if motion animations should run
      const canAnimateMotion = availableScrollDistance >= this.requiredScrollDistance;

      // --- Tagline Width & Padding Animation ---
      if (canAnimateMotion) {
        if (!this.taglineScrollControl && headerContainer) {
          // Create animation if allowed and not already active
          this.taglineScrollControl = scroll(
            (progress: any) => {
              this.taglineWidth.set(this.taglineMax - (progress * this.taglineMax));
              this.searchInputPadding.set((this.paddingMax * (1 - progress)) + (0.75 * progress));
            },
            { target: headerContainer, offset: ['start start', '300px 100px'] }
          );
        }
      } else {
        // Stop animation if it exists
        if (this.taglineScrollControl) {
          if (this.taglineScrollControl && typeof this.taglineScrollControl.stop === 'function') {
            this.taglineScrollControl.stop();
          }
          this.taglineScrollControl = null;
        }
        // Always reset styles if not allowed
        this.taglineWidth.set(this.taglineMax); // Reset width
        this.searchInputPadding.set(this.paddingMax); // Reset padding
      }

      // --- Tagline X & Opacity Animation ---
      if (canAnimateMotion) {
        if (!this.taglineOpacityScrollControl && headerContainer) {
          // Create animation if allowed and not already active
          this.taglineOpacityScrollControl = scroll(
            animate('.tagline', { x: [0, -100], opacity: [1, 0] }, { duration: 1 }), // Recreate the animate call inside scroll
            { target: headerContainer, offset: ['start start', '300px 100px'] }
          );
        }
      } else {
        // Stop animation if it exists
        if (this.taglineOpacityScrollControl) {
          if (this.taglineOpacityScrollControl && typeof this.taglineOpacityScrollControl.stop === 'function') {
            this.taglineOpacityScrollControl.stop();
          }
          this.taglineOpacityScrollControl = null;
        }
        // Always reset styles if not allowed
        // Instantly reset tagline position and opacity
        // Ensure the element exists before trying to animate it for reset
        const taglineElement = document.querySelector('.tagline') as HTMLElement;
        if (taglineElement) {
          animate(taglineElement, { x: 0, opacity: 1 }, { duration: 0 });
        }
      }
    }
  }


  private createMotionAnimation() {
    const headerContainer = document.querySelector('#header-container') as HTMLDivElement;
    const contentContainer = document.querySelector('#content-container') as HTMLDivElement;

    if (!headerContainer || !contentContainer) {
      return;
    }

    // Initial padding setup (keep this)
    animate([
      [contentContainer, {
        paddingTop: `${headerContainer.clientHeight + 30}px`,
      }],
    ]);

    // REMOVED: Scroll animation for tagline width/padding (now handled in updateTransitionProgress)
    // REMOVED: Scroll animation for tagline x/opacity (now handled in updateTransitionProgress)

    // Keep the header height animation logic
    // Removed local declaration: let headerAnimation: any | null = null;
    let scrollConfigured = false; // Keep this local as it only matters during setup

    // Store subscription to unsubscribe in ngOnDestroy
    this.breakpointSubscription = this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((result) => result.matches))
      .subscribe((isSmall) => {

        if (this.headerAnimation) {
          this.headerAnimation.stop(); // Use this.headerAnimation
        }

        // Use this.headerAnimation
        this.headerAnimation = animate(headerContainer, {
          height: [
            '20.875rem', // Initial height
            isSmall ? '9.5rem' : '6.7rem' // Final height
          ]
        }, { ease: "easeIn", duration: 1, autoplay: false });

        // Link the header height animation progress to the scroll offset defined by motion
        if (!scrollConfigured) {
          scrollConfigured = true;
          // Store the cleanup function returned by scroll
          this.headerScrollCleanup = scroll((p: number) => {
            if (this.headerAnimation) {
              this.headerAnimation.time = p; // Use motion's progress 'p' to drive this animation
            }
          }, {
            target: headerContainer,
            offset: ['start start', '300px 100px'], // Use the same offset
          });
        }
      });
  }
}
