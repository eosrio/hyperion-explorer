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
  linkedSignal, computed
} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {CommonModule, isPlatformBrowser, NgOptimizedImage} from "@angular/common";
import {SearchService} from "../../services/search.service";
import {DataService} from "../../services/data.service";
import {faHeart, faSearch} from "@fortawesome/free-solid-svg-icons";
import {ExplorerMetadata} from "../../interfaces";
import {MatAutocomplete, MatAutocompleteTrigger, MatOption} from "@angular/material/autocomplete";
import {Router, RouterLink, RouterOutlet} from "@angular/router";
import {debounceTime, Subscription} from "rxjs"; // Added Subscription import
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

  // ⭐ Added: Signals and variables to store animation endpoints (pixels) for mathematical calculation
  private headerHeightStart = signal(0);
  private headerHeightEndSmall = 0;
  private headerHeightEndLarge = 0;
  private currentHeaderHeightEnd = signal(0);


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
  // private headerAnimation: any | null = null; // ⭐ Removed: Header animation is now manually controlled
  private taglineAnimation: any | null = null;
  private breakpointSubscription: Subscription | null = null; // To store breakpoint observer subscription

  private pendingScrollUpdate: number | null = null; // For rAF throttling
  private manualAnimationFrame: number | null = null;

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

  // ⭐ Added: Manually setup passive scroll listener for better performance
  private setupScrollListener() {
    if (isPlatformBrowser(this.platformId)) {
      // Use passive: true to tell the browser we won't call preventDefault(), improving scroll smoothness.
      window.addEventListener('scroll', this.onWindowScroll, { passive: true });
    }
  }

  private cleanupViewportListeners() {
    if (this.visualViewport) {
      // We must use the exact same function reference (onViewportChange) for removal.
      this.visualViewport.removeEventListener('resize', this.onViewportChange);
      this.visualViewport.removeEventListener('scroll', this.onViewportChange);
    }
  }

  // ⭐ Added: Cleanup scroll listener
  private cleanupScrollListener() {
    if (isPlatformBrowser(this.platformId)) {
      // Must use the same function reference for removal.
      window.removeEventListener('scroll', this.onWindowScroll);
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
    // this.headerAnimation?.stop(); // ⭐ Removed
    // this.headerAnimation = null; // ⭐ Removed

    this.cleanupViewportListeners();
    this.cleanupScrollListener(); // ⭐ Added: Cleanup passive scroll listener

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

    this.stopManualAnimation();
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
  // @HostListener('window:scroll', []) // ⭐ Removed: Replaced with manual passive listener
  // ⭐ Refactored to arrow function for 'this' binding and passive listening
  private onWindowScroll = (): void => {
    if (!isPlatformBrowser(this.platformId)) return;

    // Throttling: If an update is already scheduled, do nothing.
    if (this.pendingScrollUpdate !== null) {
      return;
    }

    // Schedule the update in the next animation frame.
    this.pendingScrollUpdate = requestAnimationFrame(() => {
      // ⭐ Check if onViewportChange ran synchronously and cleared the pending update.
      if (this.pendingScrollUpdate === null) return;

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
    // Keep window:resize as a fallback and for desktop.
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

  private updateTransitionProgress(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.stopManualAnimation();

    const viewportHeight = (this.visualViewport ? this.visualViewport.height : window.innerHeight);
    const availableScrollDistance = document.documentElement.scrollHeight - viewportHeight;
    const currentScrollY = window.scrollY;

    let progress = 0;
    // ⭐ Ensure calculation only starts if scrolling is possible or required distance is set.
    if (this.requiredScrollDistance > 0 && (availableScrollDistance >= this.requiredScrollDistance || currentScrollY > 0)) {
      progress = Math.min(1, Math.max(0, currentScrollY / this.requiredScrollDistance));
    }

    this.applyTransitionProgress(progress);
  }

  toggleDevCollapse(): void {
    const target = this.transitionProgress() >= 0.95 ? 0 : 1;
    this.animateProgressTo(target);
  }

  private animateProgressTo(target: number, duration = 400): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.applyTransitionProgress(target);
      return;
    }

    const clampedTarget = Math.min(1, Math.max(0, target));
    this.stopManualAnimation();

    const start = this.transitionProgress();
    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, Math.max(0, elapsed / duration));
      const eased = start + (clampedTarget - start) * this.easeInOut(t);
      this.applyTransitionProgress(eased);

      if (t < 1) {
        this.manualAnimationFrame = requestAnimationFrame(step);
      } else {
        this.manualAnimationFrame = null;
        this.applyTransitionProgress(clampedTarget);
      }
    };

    this.manualAnimationFrame = requestAnimationFrame(step);
  }

  // ⭐ Optimization: Use a consistent easing function for both manual and scroll animations for smoothness.
  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  private stopManualAnimation(): void {
    if (this.manualAnimationFrame !== null) {
      cancelAnimationFrame(this.manualAnimationFrame);
      this.manualAnimationFrame = null;
    }
  }

  // ⭐ CRITICAL Optimization: Refactored to eliminate layout thrashing caused by reading clientHeight.
  private applyTransitionProgress(progress: number): void {
    const clampedProgress = Math.min(1, Math.max(0, progress));

    if (!isPlatformBrowser(this.platformId)) {
      this.transitionProgress.set(clampedProgress);
      return;
    }

    const animating = clampedProgress > 0.01 && clampedProgress < 0.99;
    if (this.isAnimating() !== animating) {
      this.isAnimating.set(animating);
    }

    const headerContainer = this.headerContainerRef()?.nativeElement;
    const contentContainer = this.contentContainerRef()?.nativeElement;
    // Use getElementById for reliability.
    const taglineElement = document.getElementById('tagline');
    const searchInputElement = this.searchFieldRef()?.nativeElement;

    // --- BATCHED WRITE PHASE START ---

    // ⭐ 1. Calculate Height Mathematically (Avoids DOM Read)
    let calculatedHeight = 0;
    if (headerContainer) {
      const startHeight = this.headerHeightStart();
      const endHeight = this.currentHeaderHeightEnd();

      // Apply easing to the progress for smoother height transition.
      const easedProgress = this.easeInOut(clampedProgress);

      calculatedHeight = startHeight + (endHeight - startHeight) * easedProgress;

      // WRITE 1A: Apply calculated height to the header.
      headerContainer.style.height = `${calculatedHeight}px`;
    }

    /* ⭐ Removed: Replaced Motion One header animation with manual control.
    if (this.headerAnimation) {
      this.headerAnimation.time = clampedProgress;
    }
    */

    // WRITE 2: Tagline Animation (Motion One - uses transforms/opacity)
    if (this.taglineAnimation) {
      // Tagline animation progress remains linear relative to scroll.
      this.taglineAnimation.time = clampedProgress;
    }

    // WRITE 3: Tagline Width
    if (taglineElement) {
      const newTaglineWidth = this.taglineMax - (clampedProgress * this.taglineMax);
      taglineElement.style.width = `${newTaglineWidth}px`;
    }

    // WRITE 4: Search Input Padding
    if (searchInputElement) {
      const newPadding = (this.paddingMax * (1 - clampedProgress)) + (0.75 * clampedProgress);
      searchInputElement.style.paddingTop = `${newPadding}rem`;
      searchInputElement.style.paddingBottom = `${newPadding}rem`;
    }

    // ⭐ WRITE 1B: Apply calculated height to content padding.
    // CRITICAL Optimization: This avoids the expensive headerContainer.clientHeight read, significantly reducing layout thrash.
    /* ⭐ Removed: Original code causing thrash
    let newHeight = 0;
    if (headerContainer) {
      newHeight = headerContainer.clientHeight; // LAYOUT THRASHING POINT
    }
    ...
    if (contentContainer && newHeight > 0) {
      contentContainer.style.paddingTop = `${newHeight + 30}px`;
    }
    */
    if (contentContainer && calculatedHeight > 0) {
      contentContainer.style.paddingTop = `${calculatedHeight + 30}px`;
    }


    // --- BATCHED WRITE PHASE END ---

    // --- READ PHASE START (Layout Thrash Inevitable Here) ---
    // We must refresh the LayoutTransitionComponents because the writes above changed the positions
    // of the source/target elements. This forces synchronous DOM reads (getBoundingClientRect).
    // While unavoidable in this architecture, the overall thrashing is significantly reduced.
    this.logoLayoutTransitionRef()?.refreshSynchronously();
    this.searchbarLayoutTransition()?.refreshSynchronously();

    // --- READ PHASE END ---

    this.transitionProgress.set(clampedProgress);
  }


  private initObserversAndAnimations() {
    // We use ViewChild references now.
    const headerContainer = this.headerContainerRef()?.nativeElement;
    // const taglineElement = document.querySelector('.tagline') as HTMLElement; // Original
    const taglineElement = document.getElementById('tagline'); // ⭐ Standardized selector

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

        // ⭐ 3. Update the current animation endpoint signal based on breakpoint
        const newEndpoint = isSmallForAnimation ? this.headerHeightEndSmall : this.headerHeightEndLarge;
        this.currentHeaderHeightEnd.set(newEndpoint);

        /* ⭐ Removed: We no longer use Motion One for the header animation.
        // 3. Recreate animation
        this.createHeaderAnimation(headerContainer, isSmallForAnimation);
        */

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

    // Define the animation (taken from the original scroll(animate(...)) wrapper)
    this.taglineAnimation = animate(
      taglineElement,
      {x: [0, -100], opacity: [1, 0]},
      {duration: 1, autoplay: false} // Set autoplay to false so we can control it via .time
    );
  }

  /* ⭐ Removed: Function is no longer used as header animation is manually controlled.
  // Helper method extracted from the original createMotionAnimation
  private createHeaderAnimation(headerContainer: HTMLDivElement, isSmall: boolean) {
    if (this.headerAnimation) {
      this.headerAnimation.stop();
    }

    this.headerAnimation = animate(headerContainer, {
      height: [
        '20.875rem', // Initial height
        // Use the heights defined in the original component
        isSmall ? '9.5rem' : '6.7rem' // Final height (9.5rem allows space for the wrapped search bar)
      ]
    }, {ease: "easeIn", duration: 1, autoplay: false}); // Ensure autoplay is false

  }
  */

  // Initialization using afterNextRender phases to avoid layout thrash
  private initializeLayoutAndListeners() {
    afterNextRender({
      // Phase 1: Read initial dimensions before any writes occur.
      earlyRead: () => {
        const headerContainer = this.headerContainerRef()?.nativeElement;
        const initialHeight = headerContainer ? headerContainer.clientHeight : 0;

        // ⭐ Optimization: Read font size to convert rem animation targets to pixels
        const computedStyle = window.getComputedStyle(document.documentElement);
        const fontSize = parseFloat(computedStyle.fontSize);

        // Define the CSS targets in rem (from the original CSS/animation definition)
        const heightStartRem = 20.875;
        const heightEndSmallRem = 9.5;
        const heightEndLargeRem = 6.7;

        return {
          initialHeight,
          // ⭐ Pass calculated pixel values to the write phase
          heightStartPx: heightStartRem * fontSize,
          heightEndSmallPx: heightEndSmallRem * fontSize,
          heightEndLargePx: heightEndLargeRem * fontSize,
        };
      },
      // Phase 2: Initialize animations, observers, and apply initial layout based on readings.
      // write: ({ initialHeight }) => { // Original
      write: (readings) => { // ⭐ Updated signature
        const { initialHeight, heightStartPx, heightEndSmallPx, heightEndLargePx } = readings;

        // ⭐ Store the calculated pixel values for animation endpoints
        // Use the actual measured initial height if available, otherwise fallback to the calculated start height.
        this.headerHeightStart.set(initialHeight > 0 ? initialHeight : heightStartPx);
        this.headerHeightEndSmall = heightEndSmallPx;
        this.headerHeightEndLarge = heightEndLargePx;


        // Apply initial padding based on the value read in earlyRead.
        const contentContainer = this.contentContainerRef()?.nativeElement;
        if (contentContainer && initialHeight > 0) {
          contentContainer.style.paddingTop = `${initialHeight + 30}px`;
        }

        // Initialize observers and animations (now optimized)
        this.setInitialStyles();
        this.initObserversAndAnimations();
        this.setupViewportListeners();
        this.setupScrollListener(); // ⭐ Added: Setup passive scroll listener
      },
      // Phase 3: Read finalized positions after all writes are flushed.
      read: () => {
        this.updateTransitionProgress();
      }
    });
  }

  // Helper to set initial styles synchronously for direct manipulation
  private setInitialStyles() {
    const taglineElement = document.getElementById('tagline');
    const searchInputElement = this.searchFieldRef()?.nativeElement;

    // Apply initial state (progress = 0) if styles haven't been set yet.
    if (taglineElement && taglineElement.style.width === '') {
      taglineElement.style.width = `${this.taglineMax}px`;
    }
    if (searchInputElement && searchInputElement.style.paddingTop === '') {
      searchInputElement.style.paddingTop = `${this.paddingMax}rem`;
      searchInputElement.style.paddingBottom = `${this.paddingMax}rem`;
    }
  }
}
