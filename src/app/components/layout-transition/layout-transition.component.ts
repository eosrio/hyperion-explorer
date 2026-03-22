import {
  afterNextRender,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  linkedSignal,
  OnDestroy,
  PLATFORM_ID,
  signal
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from "@angular/common";
import {Subject} from "rxjs";

// Define a type for the required measurements. This simplifies the coordinate adjustment logic.
type RectMeasurements = { top: number, left: number, width: number, height: number };

@Component({
  selector: 'app-layout-transition',
  imports: [],
  templateUrl: './layout-transition.component.html',
  styleUrl: './layout-transition.component.css'
})
export class LayoutTransitionComponent implements OnDestroy {

  observedIds = input<string[]>([]);
  platformId = inject(PLATFORM_ID);

  progress = input(0);

  sourceDiv = input<HTMLDivElement | undefined>(undefined);
  targetDiv = input<HTMLDivElement | undefined>(undefined);

  private pendingRefreshFrame: number | null = null;

  // FIX: Reference to the Visual Viewport API for mobile/iOS support
  private visualViewport = (isPlatformBrowser(this.platformId) && window.visualViewport) || null;


  private getDOMRect(element: HTMLDivElement | undefined): RectMeasurements {
    if (isPlatformBrowser(this.platformId) && element) {
      // getBoundingClientRect is relative to the visual viewport.
      const rect = element.getBoundingClientRect();

      // Adjust coordinates for iOS Safari's handling of position: fixed.
      // Inconsistencies in Safari regarding whether `position: fixed` anchors to the Layout or Visual Viewport
      // during toolbar transitions cause misalignment. We use the Visual Viewport API's offsets
      // (the distance between the Layout and Visual viewports) to stabilize the coordinates
      // relative to the Layout Viewport.
      if (this.visualViewport) {
        return {
          top: rect.top + this.visualViewport.offsetTop,
          left: rect.left + this.visualViewport.offsetLeft,
          width: rect.width,
          height: rect.height,
        };
      }

      // Fallback for other browsers.
      return {top: rect.top, left: rect.left, width: rect.width, height: rect.height};

    } else {
      return {top: 0, left: 0, width: 0, height: 0};
    }
  };

  sourceDOMRect = linkedSignal(() => this.getDOMRect(this.sourceDiv()));
  targetDOMRect = linkedSignal(() => this.getDOMRect(this.targetDiv()));

  topDelta = linkedSignal(() => this.targetDOMRect().top - this.sourceDOMRect().top);
  leftDelta = linkedSignal(() => this.targetDOMRect().left - this.sourceDOMRect().left);
  widthDelta = linkedSignal(() => this.targetDOMRect().width - this.sourceDOMRect().width);
  heightDelta = linkedSignal(() => this.targetDOMRect().height - this.sourceDOMRect().height);

  isReady = signal(false);

  // Computed styles object
  styles = computed(() => {
    const progress = this.progress();
    const source = this.sourceDOMRect();
    const target = this.targetDOMRect();

    // FIX: Defensive check against tracking invisible elements (e.g., display: none).
    // If source or target measurements are zero, or the target div input is undefined, hide the element.
    if (!this.targetDiv() || source.width === 0 || source.height === 0 || target.width === 0 || target.height === 0) {
      // Return styles that hide the element safely
      return {top: '0px', left: '0px', width: '0px', height: '0px', visibility: 'hidden'};
    }

    const top = Math.round(progress * this.topDelta() + source.top) + "px";
    const left = Math.round(progress * this.leftDelta() + source.left) + "px";
    const width = Math.round(progress * this.widthDelta() + source.width) + "px";
    // The original "- 8" is kept.
    const heightVal = progress * this.heightDelta() + source.height;
    const heightCalc = (heightVal > 8 ? heightVal - 8 : Math.max(0, heightVal));
    const height = Math.round(heightCalc) + "px";

    return {top, left, width, height, visibility: 'visible'};
  });


  resize$ = new Subject<void>();

  constructor() {
    afterNextRender(() => {
      this.refresh(); // Initial refresh
      this.makeReady();
      this.observeMutations();
    });

    effect(() => {
      this.targetDiv();
      this.sourceDiv();
      // Use scheduleRefresh for async updates (like breakpoint changes)
      this.scheduleRefresh();
    });
  }


  // Public method for synchronous refresh.
  public refreshSynchronously() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Cancel any pending async refresh to avoid conflicts
    if (this.pendingRefreshFrame !== null) {
      cancelAnimationFrame(this.pendingRefreshFrame);
      this.pendingRefreshFrame = null;
    }

    // Perform the refresh immediately
    this.refresh();
  }

  // Asynchronous refresh (for standard resize, mutations)
  scheduleRefresh() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Debounce using double requestAnimationFrame (rAF)
    if (this.pendingRefreshFrame !== null) {
      cancelAnimationFrame(this.pendingRefreshFrame);
    }

    // Double rAF ensures stabilization before measurement for these events.
    this.pendingRefreshFrame = requestAnimationFrame(() => {
      this.pendingRefreshFrame = requestAnimationFrame(() => {
        this.refresh();
        this.pendingRefreshFrame = null;
      });
    });
  }

  observeMutations() {
    this.resize$.subscribe(() => {
      this.scheduleRefresh();
    });

    const observer = new MutationObserver((list) => {
      if (list.length > 0) {
        this.scheduleRefresh();
      }
    });

    for (const id of this.observedIds()) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element, {
          attributes: true,
          childList: false,
          subtree: false
        });
      }
    }
  }

  private refresh() {
    // 1. Capture all measurements synchronously from the DOM.
    // This now captures the adjusted coordinates.
    const newTargetRect = this.getDOMRect(this.targetDiv());
    const newSourceRect = this.getDOMRect(this.sourceDiv());

    // Optimization: Only update if changed significantly
    if (this.areRectsDifferent(this.targetDOMRect(), newTargetRect) || this.areRectsDifferent(this.sourceDOMRect(), newSourceRect)) {
      // 2. Update the base signals.
      this.targetDOMRect.set(newTargetRect);
      this.sourceDOMRect.set(newSourceRect);

      // 3. Update delta signals based on the captured values.
      this.topDelta.set(newTargetRect.top - newSourceRect.top);
      this.leftDelta.set(newTargetRect.left - newSourceRect.left);
      this.widthDelta.set(newTargetRect.width - newSourceRect.width);
      this.heightDelta.set(newTargetRect.height - newSourceRect.height);
    }
  }

  // Helper to prevent tiny subpixel differences from triggering updates
  private areRectsDifferent(rect1: any, rect2: any): boolean {
    const threshold = 0.1; // pixels
    return Math.abs(rect1.top - rect2.top) > threshold ||
      Math.abs(rect1.left - rect2.left) > threshold ||
      Math.abs(rect1.width - rect2.width) > threshold ||
      Math.abs(rect1.height - rect2.height) > threshold;
  }

  makeReady() {
    // Trigger the CSS fade-in transition shortly after render.
    setTimeout(() => this.isReady.set(true), 50);
  }

  @HostListener('window:resize')
  onResize(): void {
    // Keep window:resize as a fallback and for desktop.
    // Note: The parent component now handles resize synchronously, but this acts as a secondary trigger if needed.
    this.resize$.next();
  }

  ngOnDestroy() {
    if (this.pendingRefreshFrame !== null && isPlatformBrowser(this.platformId)) {
      cancelAnimationFrame(this.pendingRefreshFrame);
      this.pendingRefreshFrame = null;
    }
    this.resize$.complete();
  }
}
