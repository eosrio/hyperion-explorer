import {
  afterNextRender,
  Component,
  computed, effect,
  HostListener,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
  signal,
  OnDestroy
} from '@angular/core';
import {isPlatformBrowser} from "@angular/common";
import {Subject} from "rxjs";

@Component({
  selector: 'app-layout-transition',
  imports: [],
  template: `
    <div #wrapper class="fixed " style="z-index: 99"
         [style.opacity]="opacity()"
         [style.top]="top()"
         [style.width]="width()"
         [style.height]="height()"
         [style.left]="left()">
      <ng-content></ng-content>
    </div>
  `
})
export class LayoutTransitionComponent implements OnDestroy {

  observedIds = input<string[]>([]);
  platformId = inject(PLATFORM_ID);

  // The progress of the transition
  progress = input(0);

  // The source and target divs
  sourceDiv = input<HTMLDivElement | undefined>(undefined);
  targetDiv = input<HTMLDivElement | undefined>(undefined);

  // ⭐ Property to track pending animation frame for debouncing
  private pendingRefreshFrame: number | null = null;

  private getDOMRect(element: HTMLDivElement | undefined): DOMRect | {top: number, left: number, width: number, height: number} {
    if (isPlatformBrowser(this.platformId) && element) {
      return element.getBoundingClientRect();
    } else {
      return {top: 0, left: 0, width: 0, height: 0};
    }
  };

  sourceDOMRect = linkedSignal(() => this.getDOMRect(this.sourceDiv()));
  targetDOMRect = linkedSignal(() => this.getDOMRect(this.targetDiv()));

  // The deltas between the source and target divs
  topDelta = linkedSignal(() => {
    return this.targetDOMRect().top - this.sourceDOMRect().top;
  });

  leftDelta = linkedSignal(() => {
    return this.targetDOMRect().left - this.sourceDOMRect().left;
  });

  widthDelta = linkedSignal(() => {
    return this.targetDOMRect().width - this.sourceDOMRect().width;
  });

  heightDelta = linkedSignal(() => {
    return this.targetDOMRect().height - this.sourceDOMRect().height;
  });

  // The computed styles for the transition
  top = computed(() => {
    return (this.progress() * this.topDelta() + this.sourceDOMRect().top) + "px";
  });

  left = computed(() => {
    return (this.progress() * this.leftDelta() + this.sourceDOMRect().left) + "px";
  });

  width = computed(() => {
    return (this.progress() * this.widthDelta() + this.sourceDOMRect().width) + "px";
  });

  height = computed(() => {
    // The original "- 8" is kept, assuming it's intentional styling.
    return (this.progress() * this.heightDelta() + this.sourceDOMRect().height - 8) + "px";
  });

  opacity = signal(0);

  resize$ = new Subject<void>();

  constructor() {
    afterNextRender(() => {
      this.fadeIn();
      this.observeMutations();
    });

    // CRUCIAL: Add an effect to refresh when the targetDiv or sourceDiv input signal changes dynamically.
    effect(() => {
      // Access the signals to register the dependency
      this.targetDiv();
      this.sourceDiv();

      this.scheduleRefresh();
    });
  }

  scheduleRefresh() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Cancel any previously scheduled refresh (inner or outer rAF) to debounce.
    if (this.pendingRefreshFrame !== null) {
      cancelAnimationFrame(this.pendingRefreshFrame);
    }

    // Double rAF ensures that the browser layout engine AND Angular CD have stabilized
    // before we measure the dimensions in refresh().
    this.pendingRefreshFrame = requestAnimationFrame(() => {
      // We are now in the first frame. Schedule the actual work in the subsequent frame.
      // Crucially, update the pending frame handle to the inner rAF for correct cancellation if needed.
      this.pendingRefreshFrame = requestAnimationFrame(() => {
        this.refresh();
        this.pendingRefreshFrame = null;
      });
    });
  }

  observeMutations() {
    // ... (Existing implementation remains the same)
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

  refresh() {
    // 1. Capture all measurements synchronously from the DOM.
    const newTargetRect = this.getDOMRect(this.targetDiv());
    const newSourceRect = this.getDOMRect(this.sourceDiv());

    // 2. Update the base signals.
    this.targetDOMRect.set(newTargetRect);
    this.sourceDOMRect.set(newSourceRect);

    // 3. Update delta signals based on the captured values (avoids reading signals immediately after setting them).
    this.topDelta.set(newTargetRect.top - newSourceRect.top);
    this.leftDelta.set(newTargetRect.left - newSourceRect.left);
    // Use the standardized DOMRect measurements for width/height deltas
    this.widthDelta.set(newTargetRect.width - newSourceRect.width);
    this.heightDelta.set(newTargetRect.height - newSourceRect.height);
  }

  fadeIn() {
    // ... (Existing implementation remains the same)
    requestAnimationFrame(() => {
      const opacity = this.opacity();
      if (opacity < 1) {
        this.opacity.set(opacity + 0.05);
        this.fadeIn();
      }
    });
  }

  @HostListener('window:resize')
  onResize(): void {
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
