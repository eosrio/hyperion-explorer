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
  linkedSignal, computed, ChangeDetectorRef
} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {CommonModule, isPlatformBrowser, NgOptimizedImage} from "@angular/common";
import {SearchService} from "../../services/search.service";
import {DataService} from "../../services/data.service";
import {faHeart, faSearch} from "@fortawesome/free-solid-svg-icons";
import {ExplorerMetadata} from "../../interfaces";
import {MatAutocomplete, MatAutocompleteTrigger, MatOption} from "@angular/material/autocomplete";
import {Router, RouterLink, RouterOutlet} from "@angular/router";
import {debounceTime, map, Subscription} from "rxjs"; // Added Subscription import
import {MatButton} from "@angular/material/button";

import {version as PackageVersion} from '../../../../package.json';
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {LayoutTransitionComponent} from "../../components/layout-transition/layout-transition.component";
// Import AnimationControls and ensure animate/scroll are imported
import {animate} from "motion"; // Removed AnimationControls import
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {ThemeSelectorComponent} from "../../components/theme-selector/theme-selector.component";
import {faGithub, faTelegram} from "@fortawesome/free-brands-svg-icons";


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
  cdr = inject(ChangeDetectorRef);

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

  private visualViewport = (isPlatformBrowser(this.platformId) && window.visualViewport) || null;


  // Define the breakpoint for 'sm' (640px / 40rem) - matches Tailwind 'sm'
  private readonly LAYOUT_BREAKPOINT = '(width < 40rem)';

  // ViewChild references for the target divs (optional, as they might not be immediately available)
  logoTargetDivMobileRef = viewChild<ElementRef<HTMLDivElement>>('logoTargetDivMobile');
  logoTargetDivDesktopRef = viewChild<ElementRef<HTMLDivElement>>('logoTargetDivDesktop');

  // ViewChild references for LayoutTransitionComponents
  logoLayoutTransitionRef = viewChild<LayoutTransitionComponent>('logoLayoutTransition');
  searchbarLayoutTransition = viewChild<LayoutTransitionComponent>('searchbarLayoutTransition');

  // FIX: ViewChild references for containers (required for synchronous padding updates)
  headerContainerRef = viewChild<ElementRef<HTMLDivElement>>('headerContainer');
  contentContainerRef = viewChild<ElementRef<HTMLDivElement>>('contentContainer');

  // Signal to track mobile state for layout
  isMobileLayout = signal<boolean>(false);
  // Signal to track animation state for CSS performance optimization
  isAnimating = signal<boolean>(false);

  // ⭐ Define animation parameters for synchronized height calculation (must match CSS)
  private readonly INITIAL_HEADER_HEIGHT = '20.875rem';
  private readonly FINAL_HEADER_HEIGHT_SM = '9.5rem';
  private readonly FINAL_HEADER_HEIGHT_LG = '6.7rem';

  // ⭐ Store current animation targets (start/end heights in pixels) for calculations
  private currentAnimationHeights = { startPx: 0, endPx: 0 };

  // FIX: Helper Function to check if an element is actually visible (has dimensions)
  private isElementVisible(el: HTMLElement | undefined): boolean {
    if (!el || !isPlatformBrowser(this.platformId)) return false;
    // Check if getBoundingClientRect has non-zero dimensions. This accounts for display: none.
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // FIX: Computed signal to determine the current active target div robustly
  currentTargetDiv = computed<HTMLDivElement | undefined>(() => {
    const mobileDiv = this.logoTargetDivMobileRef()?.nativeElement;
    const desktopDiv = this.logoTargetDivDesktopRef()?.nativeElement;

    // Prioritize based on the expected layout state (isMobileLayout)
    const expectedMobile = this.isMobileLayout();

    if (expectedMobile) {
      // Verify the mobile div is actually rendered and visible.
      if (this.isElementVisible(mobileDiv)) {
        return mobileDiv;
      }
      // Fallback: If mobile isn't ready, perhaps desktop is still visible during a transition.
      if (this.isElementVisible(desktopDiv)) {
        return desktopDiv;
      }
    } else {
      // Verify the desktop div is rendered and visible.
      if (this.isElementVisible(desktopDiv)) {
        return desktopDiv;
      }
      // Fallback: If desktop isn't ready, perhaps mobile is still visible.
      if (this.isElementVisible(mobileDiv)) {
        return mobileDiv;
      }
    }

    // If neither is visible, return undefined. This prevents tracking a zero-sized element.
    return undefined;
  });

  chainData = linkedSignal<ExplorerMetadata>(() => {
    const data = this.dataService.explorerMetadata();
    if (data) {
      return data;
    } else {
      return {} as ExplorerMetadata;
    }
  });
  searchFieldRef = viewChild<ElementRef<HTMLInputElement>>('searchFieldRef');
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
  // taglineWidth = signal(this.taglineMax);
  // searchInputPadding = signal(this.paddingMax);

  showThemeSelector = signal(false);

  // Required scroll distance for the animation (in pixels)
  private readonly requiredScrollDistance = 100;

  // Store animation controls
  private headerAnimation: any | null = null; // Promoted to class property
  private taglineAnimation: any | null = null;
  private breakpointSubscription: Subscription | null = null; // To store breakpoint observer subscription

  private pendingScrollUpdate: number | null = null; // For rAF throttling

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
      this.initializeLayoutAndListeners();
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.startPlaceholderAnimation(); // Start placeholder animation
    }
    if (this.dataService.routeError) {
      this.err.set(this.dataService.routeError);
      this.dataService.routeError = '';
    }
  }

  // FIX: Centralized Viewport Listener Implementation (Hybrid Synchronization)
  private setupViewportListeners() {
    if (this.visualViewport) {
      // When the viewport changes (iOS UI resize/scroll), trigger the synchronous handler.
      this.visualViewport.addEventListener('resize', this.onViewportChange);
      this.visualViewport.addEventListener('scroll', this.onViewportChange);
    }
  }

  private cleanupViewportListeners() {
    if (this.visualViewport) {
      // We must use the exact same function reference (onViewportChange) for removal.
      this.visualViewport.removeEventListener('resize', this.onViewportChange);
      this.visualViewport.removeEventListener('scroll', this.onViewportChange);
    }
  }

  // CRITICAL FIX: Synchronous handler for viewport changes (iOS UI/Resize).
  // Defined as arrow function for automatic 'this' binding when used as event listener.
  private onViewportChange = (): void => {
    if (!isPlatformBrowser(this.platformId)) return;

    // Cancel any pending rAF scroll update as we are updating synchronously now.
    // This preempts the standard scroll handler to prevent race conditions.
    if (this.pendingScrollUpdate !== null) {
      cancelAnimationFrame(this.pendingScrollUpdate);
      this.pendingScrollUpdate = null;
    }
    // Update immediately to prevent jumps on Safari during viewport changes.
    this.updateTransitionProgress();
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

    const inputElement = this.searchFieldRef()?.nativeElement;
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
        this.scrambleQueue.push({from: fromCh, to: toCh, start: 0, end: 0});
      } else {
        // Left-to-right stagger with a bit more emphasis and jitter for a clearer wave
        const progress = maxLen > 1 ? i / (maxLen - 1) : 0;
        const start = progress * (this.scrambleDuration * 0.7) + Math.random() * (this.scrambleDuration * 0.08);
        const end = start + (this.scrambleDuration * (0.28 + Math.random() * 0.18)); // keep window similar
        this.scrambleQueue.push({from: fromCh, to: toCh, start, end});
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
    this.taglineAnimation?.stop();
    this.taglineAnimation = null;

    // Stop and clear header animation
    this.headerAnimation?.stop();
    this.headerAnimation = null;

    this.cleanupViewportListeners();

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


    if (isPlatformBrowser(this.platformId)) {
      if (this.pendingScrollUpdate !== null) {
        cancelAnimationFrame(this.pendingScrollUpdate);
        this.pendingScrollUpdate = null;
      }
    }
  }


  @HostListener('window:keydown', ['$event'])
  onKeyPressed(event: KeyboardEvent) {
    // detect Ctrl+Shift+F
    if (event.ctrlKey && event.shiftKey && event.key === 'F') {
      console.log('Focus on search field', this.searchFieldRef());
      // focus on the search_field of this.searchForm
      this.searchFieldRef()?.nativeElement.focus();
    }
  }

  // Update transition progress on scroll
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Throttling: If an update is already scheduled, do nothing.
    if (this.pendingScrollUpdate !== null) {
      return;
    }

    // Schedule the update in the next animation frame.
    this.pendingScrollUpdate = requestAnimationFrame(() => {
      this.updateTransitionProgress();
      // Clear the flag so the next scroll event can schedule a new update.
      this.pendingScrollUpdate = null;
    });
  }


  // If the user focuses the input while scrambling, stop immediately
  @HostListener('window:focusin', ['$event'])
  onFocusIn(event: FocusEvent): void {
    const inputEl = this.searchFieldRef()?.nativeElement;
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
    this.onViewportChange();
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

  // ⭐ Helper method to convert CSS units (rem/em/etc.) to pixels (necessary for precise calculations)
  private getPixelValue(element: HTMLElement, value: string): number {
    if (!isPlatformBrowser(this.platformId)) return 0;
    // Create a temporary element within the context of the target element to calculate the computed style robustly.
    const temp = document.createElement('div');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.height = value;
    // Append to the specific element to respect local CSS variables or contextual sizing (like root font size changes).
    element.appendChild(temp);
    const pixelValue = parseFloat(getComputedStyle(temp).height);
    element.removeChild(temp);
    return pixelValue;
  }

  private updateTransitionProgress(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Use visualViewport height if available for accuracy on mobile (respects dynamic UI)
      const viewportHeight = (this.visualViewport ? this.visualViewport.height : window.innerHeight);
      const availableScrollDistance = document.documentElement.scrollHeight - viewportHeight;
      const currentScrollY = window.scrollY;

      // Calculate progress
      let progress = 0;
      if (availableScrollDistance >= this.requiredScrollDistance || this.requiredScrollDistance > 0) {
        progress = Math.min(1, Math.max(0, currentScrollY / this.requiredScrollDistance));
      }

      // Update animation state for CSS optimization
      const animating = progress > 0.01 && progress < 0.99;
      if (this.isAnimating() !== animating) {
        this.isAnimating.set(animating);
      }

      // const headerContainer = this.headerContainerRef()?.nativeElement; // ⭐ No longer needed
      const contentContainer = this.contentContainerRef()?.nativeElement;
      // Get references for direct manipulation
      // const taglineElement = document.getElementById('tagline'); // ⭐ No longer needed for direct manipulation
      const searchInputElement = this.searchFieldRef()?.nativeElement;

      // --- THE OPTIMIZED SYNCHRONIZATION LOOP (Zoneless + Anti-Thrashing) ---
      // ⭐ Strict WRITE -> CALCULATE -> WRITE -> READ pattern. DOM reads (like clientHeight) are eliminated.

      // --- Phase 1: Apply Visual Changes (WRITE - ALL Synchronous) ---

      // 1a. Header Clip-path & Tagline Transform/Opacity (Motion library - synchronous)
      if (this.headerAnimation) {
        // ⭐ This now controls the clip-path animation (GPU accelerated).
        this.headerAnimation.time = progress;
      }
      if (this.taglineAnimation) {
        // ⭐ This now controls the optimized tagline animation (GPU accelerated).
        this.taglineAnimation.time = progress;
      }

      // 1b. Search Input Padding (Direct DOM manipulation - synchronous)
      /* ⭐ Removed manual tagline width animation.
      if (taglineElement) {
        const newTaglineWidth = this.taglineMax - (progress * this.taglineMax);
        taglineElement.style.width = `${newTaglineWidth}px`;
      }
      */

      if (searchInputElement) {
        const newPadding = (this.paddingMax * (1 - progress)) + (0.75 * progress);
        searchInputElement.style.paddingTop = `${newPadding}rem`;
        searchInputElement.style.paddingBottom = `${newPadding}rem`;
      }

      // ⭐ --- Phase 2: Calculate Layout (CALCULATE - No DOM interaction) ---

      // Calculate the intended visual height. We do NOT read clientHeight, preventing layout thrash.
      const { startPx, endPx } = this.currentAnimationHeights;
      let calculatedHeight = startPx;

      // ⭐ CRITICAL: The motion animation applies easing (easeIn) to the clip-path.
      // We must apply the same easing to the padding calculation for perfect synchronization.
      // A simple approximation of easeIn (Quadratic): progress^2
      const easedProgress = progress * progress;

      if (startPx > 0 && endPx > 0) {
        calculatedHeight = startPx + (endPx - startPx) * easedProgress;
      }

      // --- Phase 3: Apply Dependent Layout Updates (WRITE) ---
      // 3a. Update Content Padding (Direct DOM manipulation - synchronous)
      // ⭐ Apply the calculated height, ensuring synchronization with the clip-path animation.
      if (contentContainer && calculatedHeight > 0) {
        contentContainer.style.paddingTop = `${calculatedHeight + 30}px`;
      }

      // --- Phase 4: Measure Transition Targets (READ + Forced Flush) ---
      // Measure the source/target positions. (READ + Forced Flush)
      // This still forces a flush, but the overall layout cost is minimized because the header height and tagline width are fixed.
      this.logoLayoutTransitionRef()?.refreshSynchronously();
      this.searchbarLayoutTransition()?.refreshSynchronously();

      // --- Phase 5: Update Position Signal (WRITE + CD) ---
      // 5a. Update Position (via Signal)
      this.transitionProgress.set(progress);

      // 5b. FIX for Zoneless: Manually trigger change detection to apply style changes in this frame.
      this.cdr.markForCheck();
    }
  }


  private initObserversAndAnimations() {
    // We use ViewChild references now.
    const headerContainer = this.headerContainerRef()?.nativeElement;
    const taglineElement = document.querySelector('.tagline') as HTMLElement; // Tagline still needs querySelector

    if (!headerContainer) {
      return;
    }

    // Initialize Tagline Animation (if element exists)
    if (taglineElement) {
      this.createTaglineAnimation(taglineElement);
    }

    // --- Combined Breakpoint Observers ---
    this.breakpointSubscription = this.breakpointObserver
      .observe([
        this.LAYOUT_BREAKPOINT, // For layout switching (sm)
        Breakpoints.XSmall,
        Breakpoints.Small // For animation height
      ])
      .subscribe(state => {
        // 1. Update Layout Switching State (isMobileLayout)
        const isMobile = state.breakpoints[this.LAYOUT_BREAKPOINT];
        this.isMobileLayout.set(!!isMobile);
        // currentTargetDiv will automatically update robustly.

        // 2. Determine if animation height needs adjustment
        const isSmallForAnimation = state.breakpoints[Breakpoints.XSmall] || state.breakpoints[Breakpoints.Small];

        // 3. Recreate animation
        this.createHeaderAnimation(headerContainer, isSmallForAnimation);

        // 4. Ensure synchronization immediately after layout/target changes
        // Trigger the main update loop synchronously to handle the synchronization.
        this.onViewportChange();
      });
  }

  // Helper method to create the tagline animation control
  private createTaglineAnimation(taglineElement: HTMLElement) {
    if (this.taglineAnimation) {
      this.taglineAnimation.stop();
    }

    // ⭐ Optimized Tagline Animation: Use transforms (translateX and scaleX) instead of layout properties (width).
    // We must combine them in the transform property keyframes. This is highly performant.
    this.taglineAnimation = animate(
      taglineElement,
      {
        // Define the combined transform explicitly.
        transform: ['translateX(0px) scaleX(1)', 'translateX(-100px) scaleX(0)'],
        opacity: [1, 0]
      },
      // {x: [0, -100], opacity: [1, 0]}, // OLD
      {duration: 1, autoplay: false} // Set autoplay to false so we can control it via .time
    );
  }

  // Helper method extracted from the original createMotionAnimation
  private createHeaderAnimation(headerContainer: HTMLDivElement, isSmall: boolean) {
    if (this.headerAnimation) {
      this.headerAnimation.stop();
    }

    const startHeight = this.INITIAL_HEADER_HEIGHT;
    const endHeight = isSmall ? this.FINAL_HEADER_HEIGHT_SM : this.FINAL_HEADER_HEIGHT_LG;

    // ⭐ Convert the CSS units (rem) to pixels synchronously for accurate synchronization calculations.
    const startPx = this.getPixelValue(headerContainer, startHeight);
    const endPx = this.getPixelValue(headerContainer, endHeight);

    // ⭐ Store the parameters for use in updateTransitionProgress
    this.currentAnimationHeights = { startPx, endPx };

    // ⭐ CRITICAL CHANGE: Stop animating 'height'. Animate 'clip-path' instead.
    // This prevents layout recalculations and significantly boosts performance, especially on Safari.
    this.headerAnimation = animate(headerContainer, {
      // height: [ ... ] // OLD
      // Define the clipping rectangle from top-left (0px 0px) to bottom-right (100% Ypx).
      clipPath: [
        `polygon(0px 0px, 100% 0px, 100% ${startPx}px, 0px ${startPx}px)`,
        `polygon(0px 0px, 100% 0px, 100% ${endPx}px, 0px ${endPx}px)`
      ]
      // ⭐ We must use the same easing here ("easeIn") that we use in the mathematical calculation in updateTransitionProgress.
    }, {ease: "easeIn", duration: 1, autoplay: false}); // Ensure autoplay is false

  }

  // Initialization using afterNextRender phases to avoid layout thrash
  private initializeLayoutAndListeners() {
    afterNextRender({
      // Phase 1: Read initial dimensions before any writes occur.
      earlyRead: () => {
        const headerContainer = this.headerContainerRef()?.nativeElement;
        // ⭐ We now calculate the initial height based on the CSS definition, as the actual height is fixed.
        let initialHeight = 0;
        if (headerContainer) {
          initialHeight = this.getPixelValue(headerContainer, this.INITIAL_HEADER_HEIGHT);
        }
        // const initialHeight = headerContainer ? headerContainer.clientHeight : 0; // OLD
        return { initialHeight };
      },
      // Phase 2: Initialize animations, observers, and apply initial layout based on readings.
      write: ({ initialHeight }) => {
        // Apply initial padding based on the value read in earlyRead.
        const contentContainer = this.contentContainerRef()?.nativeElement;
        if (contentContainer && initialHeight > 0) {
          // ⭐ Ensure the initial padding matches the defined start height.
          contentContainer.style.paddingTop = `${initialHeight + 30}px`;
        }

        // Initialize observers and animations (now optimized)
        this.setInitialStyles();
        this.initObserversAndAnimations();
        this.setupViewportListeners();
      },
      // Phase 3: Read finalized positions after all writes are flushed.
      read: () => {
        this.updateTransitionProgress();
      }
    });
  }

  // Helper to set initial styles synchronously for direct manipulation
  private setInitialStyles() {
    // const taglineElement = document.getElementById('tagline'); // ⭐ No longer needed
    const searchInputElement = this.searchFieldRef()?.nativeElement;

    // Apply initial state (progress = 0) if styles haven't been set yet.
    /* ⭐ Tagline width is now fixed via CSS.
    if (taglineElement && taglineElement.style.width === '') {
      taglineElement.style.width = `${this.taglineMax}px`;
    }
    */
    if (searchInputElement && searchInputElement.style.paddingTop === '') {
      searchInputElement.style.paddingTop = `${this.paddingMax}rem`;
      searchInputElement.style.paddingBottom = `${this.paddingMax}rem`;
    }
  }
}
