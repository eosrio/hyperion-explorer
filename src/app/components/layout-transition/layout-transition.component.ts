import {
  afterNextRender,
  Component,
  computed, effect,
  HostListener,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
  signal
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
export class LayoutTransitionComponent {

  observedIds = input<string[]>([]);
  platformId = inject(PLATFORM_ID);

  // The progress of the transition
  progress = input(0);

  // The source and target divs
  sourceDiv = input<HTMLDivElement | undefined>(undefined);
  targetDiv = input<HTMLDivElement | undefined>(undefined);

  private getDOMRect(element: HTMLDivElement | undefined): DOMRect | {top: number, left: number, width: number, height: number} {
    if (isPlatformBrowser(this.platformId) && element) {
      return element.getBoundingClientRect();
    } else {
      return {top: 0, left: 0, width: 0, height: 0};
    }
  };

  // Helper functions for client dimensions
  private getClientWidth(element: HTMLDivElement | undefined): number {
    return element?.clientWidth || 0;
  }

  private getClientHeight(element: HTMLDivElement | undefined): number {
    return element?.clientHeight || 0;
  }

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
    return this.getClientWidth(this.targetDiv()) - this.getClientWidth(this.sourceDiv());
  });

  heightDelta = linkedSignal(() => {
    return this.getClientHeight(this.targetDiv()) - this.getClientHeight(this.sourceDiv());
  });

  // The computed styles for the transition
  top = computed(() => {
    return (this.progress() * this.topDelta() + this.sourceDOMRect().top) + "px";
  });

  left = computed(() => {
    return (this.progress() * this.leftDelta() + this.sourceDOMRect().left) + "px";
  });

  width = computed(() => {
    return (this.progress() * this.widthDelta() + this.getClientWidth(this.sourceDiv())) + "px";
  });

  height = computed(() => {
    return (this.progress() * this.heightDelta() + this.getClientHeight(this.sourceDiv()) - 8) + "px";
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

      // Ensure we only run the DOM-dependent refresh logic on the browser
      if (isPlatformBrowser(this.platformId)) {
        // Use setTimeout to allow the DOM/CSS (e.g., display properties toggled by responsive classes)
        // to settle before measuring the new target's bounding box.
        setTimeout(() => this.refresh(), 0);
      }
    });
  }

  observeMutations() {
    // ... (Existing implementation remains the same)
    this.resize$.subscribe(() => {
      this.refresh();
    });

    const observer = new MutationObserver((list) => {
      if (list.length > 0) {
        this.refresh();
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
    // Recalculate all dimensions and positions based on the current inputs
    this.targetDOMRect.set(this.getDOMRect(this.targetDiv()));
    this.sourceDOMRect.set(this.getDOMRect(this.sourceDiv()));
    this.topDelta.set(this.targetDOMRect().top - this.sourceDOMRect().top);
    this.leftDelta.set(this.targetDOMRect().left - this.sourceDOMRect().left);
    this.widthDelta.set(this.getClientWidth(this.targetDiv()) - this.getClientWidth(this.sourceDiv()));
    this.heightDelta.set(this.getClientHeight(this.targetDiv()) - this.getClientHeight(this.sourceDiv()));
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
}
