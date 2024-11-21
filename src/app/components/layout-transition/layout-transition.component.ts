import {
  AfterContentInit,
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  input,
  linkedSignal, OnInit,
  signal
} from '@angular/core';
import {toObservable} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-layout-transition',
  imports: [],
  templateUrl: './layout-transition.component.html',
  styleUrl: './layout-transition.component.css'
})
export class LayoutTransitionComponent {

  observedIds = input<string[]>([]);

  // The progress of the transition
  progress = input(0);

  // The source and target divs
  sourceDiv = input.required<HTMLDivElement>();
  targetDiv = input.required<HTMLDivElement>();

  // The deltas between the source and target divs
  topDelta = linkedSignal(() => {
    return this.targetDiv().offsetTop - this.sourceDiv().offsetTop;
  });

  leftDelta = linkedSignal(() => {
    return this.targetDiv().offsetLeft - this.sourceDiv().offsetLeft;
  });

  widthDelta = linkedSignal(() => {
    return this.targetDiv().clientWidth - this.sourceDiv().clientWidth;
  });

  heightDelta = linkedSignal(() => {
    return this.targetDiv().clientHeight - this.sourceDiv().clientHeight;
  });

  // The computed styles for the transition
  top = computed(() => {
    return (this.progress() * this.topDelta() + this.sourceDiv().offsetTop) + "px";
  });

  left = computed(() => {
    return (this.progress() * this.leftDelta() + this.sourceDiv().offsetLeft) + "px";
  });

  width = computed(() => {
    return (this.progress() * this.widthDelta() + this.sourceDiv().clientWidth) + "px";
  });

  height = computed(() => {
    return (this.progress() * this.heightDelta() + this.sourceDiv().clientHeight) + "px";
  });

  opacity = signal(0);

  constructor() {
    afterNextRender({
      write: () => {
        this.fadeIn();
        this.observeMutations();
      }
    });
  }

  observeMutations() {
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
          childList: true,
          subtree: true
        });
      }
    }
  }

  refresh() {
    this.topDelta.set(this.targetDiv().offsetTop - this.sourceDiv().offsetTop);
    this.leftDelta.set(this.targetDiv().offsetLeft - this.sourceDiv().offsetLeft);
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

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    // Recalculate the deltas when the window is resized
    this.refresh();
  }
}
