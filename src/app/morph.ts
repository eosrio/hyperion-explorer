import { Directive, ElementRef, HostListener, inject } from "@angular/core";
import { ViewTransitionInfo } from "@angular/router";

/**
 * Shared-element navigation: the block number, transaction ID or account a visitor clicks becomes the heading of
 * the page it opens. The clicked link and the destination's `.morph-target` share one view-transition name; while
 * the old page is captured, any `.morph-target` already on it is unnamed so the two never collide.
 */
const MORPH = "explorer-morph";
let armed: HTMLElement | null = null;

function disarm(): void {
  if (armed) armed.style.viewTransitionName = "";
  armed = null;
  if (typeof document !== "undefined") delete document.documentElement.dataset["morph"];
}

@Directive({ selector: "[appMorph]" })
export class MorphLinkDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener("click", ["$event"])
  arm(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof document === "undefined" || !("startViewTransition" in document)) return;
    disarm();
    armed = this.host.nativeElement;
    armed.style.viewTransitionName = MORPH;
    document.documentElement.dataset["morph"] = "out";
  }
}

/** Router hook: skip transitions for reduced motion, and hand the shared name to the new page's heading. */
export function onExplorerViewTransition({ transition }: ViewTransitionInfo): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    transition.skipTransition();
    disarm();
    return;
  }
  transition.updateCallbackDone.then(disarm, disarm);
  transition.finished.then(disarm, disarm);
}
