import {
  afterNextRender,
  Component,
  computed,
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
  templateUrl: './layout-transition.component.html',
  styleUrl: './layout-transition.component.css'
})
export class LayoutTransitionComponent {

  observedIds = input<string[]>([]);
  platformId = inject(PLATFORM_ID);

  // The progress of the transition
  progress = input(0);

  // The source and target divs
  sourceDiv = input.required<HTMLDivElement>();
  targetDiv = input.required<HTMLDivElement>();

  sourceDOMRect = linkedSignal(() => {
    if (isPlatformBrowser(this.platformId)) {
      return this.sourceDiv().getBoundingClientRect();
    } else {
      return {top: 0, left: 0, width: 0, height: 0};
    }
  });

  targetDOMRect = linkedSignal(() => {
    if (isPlatformBrowser(this.platformId)) {
      return this.targetDiv().getBoundingClientRect();
    } else {
      return {top: 0, left: 0, width: 0, height: 0};
    }
  });

  // The deltas between the source and target divs
  topDelta = linkedSignal(() => {
    return this.targetDOMRect().top - this.sourceDOMRect().top;
  });

  leftDelta = linkedSignal(() => {
    return this.targetDOMRect().left - this.sourceDOMRect().left;
  });

  widthDelta = linkedSignal(() => {
    return this.targetDiv().clientWidth - this.sourceDiv().clientWidth;
  });

  heightDelta = linkedSignal(() => {
    return this.targetDiv().clientHeight - this.sourceDiv().clientHeight;
  });

  // The computed styles for the transition
  top = computed(() => {
    return (this.progress() * this.topDelta() + this.sourceDOMRect().top) + "px";
  });

  left = computed(() => {
    return (this.progress() * this.leftDelta() + this.sourceDOMRect().left) + "px";
  });

  width = computed(() => {
    return (this.progress() * this.widthDelta() + this.sourceDiv().clientWidth) + "px";
  });

  height = computed(() => {
    return (this.progress() * this.heightDelta() + this.sourceDiv().clientHeight) + "px";
  });

  opacity = signal(0);

  resize$ = new Subject<void>();

  constructor() {
    afterNextRender({
      write: () => {
        this.fadeIn();
        this.observeMutations();
      }
    });
  }

  observeMutations() {

    this.resize$.subscribe(() => {
      this.refresh();
    });

    const observer = new MutationObserver((list) => {
      if (list.length > 0) {
        this.refresh();
      }
    });
    // this.sourceDiv().id = 'source-' + Math.random().toString(16).substring(2,8);
    // console.log(observer, this.sourceDiv());
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
    // console.log(`refresh at ${this.progress()}`);
    this.targetDOMRect.set(this.targetDiv().getBoundingClientRect());
    this.sourceDOMRect.set(this.sourceDiv().getBoundingClientRect());
    this.topDelta.set(this.targetDOMRect().top - this.sourceDOMRect().top);
    this.leftDelta.set(this.targetDOMRect().left - this.sourceDOMRect().left);
    this.widthDelta.set(this.targetDiv().clientWidth - this.sourceDiv().clientWidth);
    this.heightDelta.set(this.targetDiv().clientHeight - this.sourceDiv().clientHeight);
  }

  fadeIn() {
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
