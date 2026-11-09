import { Directive, ElementRef, HostListener, inject } from "@angular/core";
import { ActivatedRouteSnapshot, ViewTransitionInfo } from "@angular/router";

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

/** The URL path a router state renders, without query parameters or fragment. */
function pathOf(snapshot: ActivatedRouteSnapshot | null): string {
  const parts: string[] = [];
  for (let node = snapshot; node; node = node.firstChild) parts.push(...node.url.map(segment => segment.path));
  return parts.join("/");
}

/**
 * Router hook. A transition runs only when the page itself changes: a query-only navigation (choosing a contract
 * table, paging a scope, closing a dialog) would otherwise crossfade the whole page and paint the header and
 * headings above any open dialog. Reduced motion skips every transition.
 */
export function onExplorerViewTransition({ transition, from, to }: ViewTransitionInfo): void {
  if (pathOf(from) === pathOf(to) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    transition.skipTransition();
    disarm();
    return;
  }
  transition.updateCallbackDone.then(disarm, disarm);
  transition.finished.then(disarm, disarm);
}
