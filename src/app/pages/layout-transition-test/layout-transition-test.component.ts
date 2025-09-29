import {CommonModule} from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  signal,
  viewChild
} from '@angular/core';
import {LayoutTransitionComponent} from '../../components/layout-transition/layout-transition.component';

const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (cb: () => void) => Promise.resolve().then(cb);

@Component({
  selector: 'app-layout-transition-test',
  standalone: true,
  imports: [CommonModule, LayoutTransitionComponent],
  templateUrl: './layout-transition-test.component.html',
  styleUrl: './layout-transition-test.component.css'
})
export class LayoutTransitionTestComponent implements OnDestroy {

  readonly observedIds = ['header-container', 'tagline'];
  readonly logoUrl = 'https://ultra.eosrio.io/v2/explorer_logo';

  private readonly isBrowser = typeof window !== 'undefined';

  isCompact = signal(false);
  transitionProgress = signal(0);
  isAnimating = signal(false);

  private readonly headerExpandedRem = 20.875;
  private readonly headerCollapsedRem = 6.7;
  private readonly taglineMax = 145;

  logoTargetDivMobileRef = viewChild<ElementRef<HTMLDivElement>>('logoTargetDivMobile');
  logoTargetDivDesktopRef = viewChild<ElementRef<HTMLDivElement>>('logoTargetDivDesktop');
  searchbarTargetDivRef = viewChild<ElementRef<HTMLDivElement>>('searchbarTargetDiv');
  headerContainerRef = viewChild<ElementRef<HTMLDivElement>>('headerContainer');
  contentContainerRef = viewChild<ElementRef<HTMLDivElement>>('contentContainer');
  taglineRef = viewChild<ElementRef<HTMLDivElement>>('taglineRef');
  logoSourceDivRef = viewChild<ElementRef<HTMLDivElement>>('logoSourceDiv');
  searchbarSourceDivRef = viewChild<ElementRef<HTMLDivElement>>('searchbarSourceDiv');

  logoLayoutTransitionRef = viewChild<LayoutTransitionComponent>('logoLayoutTransition');
  searchLayoutTransitionRef = viewChild<LayoutTransitionComponent>('searchbarLayoutTransition');

  currentLogoTarget = computed(() => {
    const mobile = this.logoTargetDivMobileRef()?.nativeElement;
    const desktop = this.logoTargetDivDesktopRef()?.nativeElement;

    if (this.isElementVisible(mobile)) {
      return mobile;
    }
    if (this.isElementVisible(desktop)) {
      return desktop;
    }
    return undefined;
  });

  currentSearchbarTarget = computed(() => {
    return this.searchbarTargetDivRef()?.nativeElement ?? undefined;
  });

  private animationFrame: number | null = null;
  private logoSourceFullHeight = 0;
  private searchbarSourceFullHeight = 0;

  constructor() {
    afterNextRender(() => {
      this.refreshTransitions();
      this.syncContentPadding();
      this.captureSourceHeights();
    });

    effect(() => {
      this.currentLogoTarget();
      this.currentSearchbarTarget();
      scheduleMicrotask(() => this.scheduleRefresh());
    });

    effect(() => {
      const progress = this.transitionProgress();
      const active = progress > 0.01 && progress < 0.99;
      if (this.isAnimating() !== active) {
        this.isAnimating.set(active);
      }

      if (this.isBrowser) {
        this.applyProgressStyles(progress);
      }

      scheduleMicrotask(() => this.refreshTransitions());
    });
  }

  private captureSourceHeights() {
    const logoSource = this.logoSourceDivRef()?.nativeElement;
    const searchSource = this.searchbarSourceDivRef()?.nativeElement;

    if (logoSource) {
      logoSource.style.overflow = 'hidden';
    }
    if (searchSource) {
      searchSource.style.overflow = 'hidden';
    }

    this.logoSourceFullHeight = logoSource?.clientHeight ?? this.logoSourceFullHeight;
    this.searchbarSourceFullHeight = searchSource?.clientHeight ?? this.searchbarSourceFullHeight;
  }

  private isElementVisible(element?: HTMLElement | null): element is HTMLElement {
    if (!element) {
      return false;
    }
    if (typeof (element as any).getBoundingClientRect !== 'function') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  toggleCompact() {
    const next = !this.isCompact();
    this.isCompact.set(next);
    this.animateTo(next ? 1 : 0);
  }

  reset() {
    this.stopAnimation();
    this.isCompact.set(false);
    this.transitionProgress.set(0);
    this.refreshTransitions();
  }

  onProgressInput(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    this.transitionProgress.set(clamped);
    this.isCompact.set(clamped >= 0.5);
  }

  private animateTo(target: number) {
    if (!this.isBrowser) {
      this.transitionProgress.set(target);
      return;
    }

    this.stopAnimation();

    const start = this.transitionProgress();
    const duration = 400;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, Math.max(0, elapsed / duration));
      const eased = start + (target - start) * this.easeInOut(t);
      this.transitionProgress.set(eased);

      if (t < 1) {
        this.animationFrame = requestAnimationFrame(step);
      } else {
        this.animationFrame = null;
        this.transitionProgress.set(target);
      }
    };

    this.animationFrame = requestAnimationFrame(step);
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  private stopAnimation() {
    if (!this.isBrowser) {
      return;
    }
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private refreshTransitions() {
    if (!this.isBrowser) {
      return;
    }
    this.logoLayoutTransitionRef()?.refreshSynchronously();
    this.searchLayoutTransitionRef()?.refreshSynchronously();
  }

  private scheduleRefresh() {
    if (!this.isBrowser) {
      return;
    }
    this.logoLayoutTransitionRef()?.scheduleRefresh();
    this.searchLayoutTransitionRef()?.scheduleRefresh();
  }

  private applyProgressStyles(progress: number) {
    const header = this.headerContainerRef()?.nativeElement;
    const content = this.contentContainerRef()?.nativeElement;
    const tagline = this.taglineRef()?.nativeElement;
    const logoSource = this.logoSourceDivRef()?.nativeElement;
    const searchSource = this.searchbarSourceDivRef()?.nativeElement;
    const desktopLogoTarget = this.logoTargetDivDesktopRef()?.nativeElement;
    const mobileLogoTarget = this.logoTargetDivMobileRef()?.nativeElement;
    const searchTarget = this.searchbarTargetDivRef()?.nativeElement;

    if (header) {
      const heightRem = this.headerExpandedRem - (this.headerExpandedRem - this.headerCollapsedRem) * progress;
      header.style.height = `${heightRem}rem`;
    }

    if (tagline) {
      const width = Math.max(0, this.taglineMax - this.taglineMax * progress);
      tagline.style.width = `${width}px`;
      tagline.style.opacity = `${Math.max(0, 1 - progress * 1.2)}`;
    }

    if (header && content) {
      const measuredHeight = header.clientHeight;
      if (measuredHeight > 0) {
        content.style.paddingTop = `${measuredHeight + 30}px`;
      }
    }

    if (logoSource && this.logoSourceFullHeight > 0) {
      const newLogoHeight = Math.max(0, this.logoSourceFullHeight * (1 - progress));
      logoSource.style.height = `${newLogoHeight}px`;
      logoSource.style.opacity = `${Math.max(0, 1 - progress * 1.1)}`;
    }

    if (searchSource && this.searchbarSourceFullHeight > 0) {
      const newSearchHeight = Math.max(0, this.searchbarSourceFullHeight * (1 - progress));
      searchSource.style.height = `${newSearchHeight}px`;
      searchSource.style.opacity = `${Math.max(0, 1 - progress * 1.1)}`;
    }

    const logoFadeIn = Math.max(0, Math.min(1, (progress - 0.7) / 0.25));
    const searchFadeIn = Math.max(0, Math.min(1, (progress - 0.45) / 0.25));

    if (desktopLogoTarget) {
      desktopLogoTarget.style.opacity = `${logoFadeIn}`;
      desktopLogoTarget.style.pointerEvents = logoFadeIn > 0.95 ? 'auto' : 'none';
    }

    if (mobileLogoTarget) {
      mobileLogoTarget.style.opacity = `${logoFadeIn}`;
      mobileLogoTarget.style.pointerEvents = logoFadeIn > 0.95 ? 'auto' : 'none';
    }

    if (searchTarget) {
      searchTarget.style.opacity = `${searchFadeIn}`;
      searchTarget.style.pointerEvents = searchFadeIn > 0.95 ? 'auto' : 'none';
    }
  }

  private syncContentPadding() {
    const header = this.headerContainerRef()?.nativeElement;
    const content = this.contentContainerRef()?.nativeElement;
    if (header && content) {
      const measuredHeight = header.clientHeight;
      if (measuredHeight > 0) {
        content.style.paddingTop = `${measuredHeight + 30}px`;
      }
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.scheduleRefresh();
  }

  ngOnDestroy() {
    this.stopAnimation();
  }
}
