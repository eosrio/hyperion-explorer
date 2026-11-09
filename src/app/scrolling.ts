import { ViewportScroller, isPlatformBrowser } from "@angular/common";
import { inject, PLATFORM_ID, provideEnvironmentInitializer } from "@angular/core";
import { Router, Scroll } from "@angular/router";

const RESTORE_WINDOW_MS = 2000;

function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}

/**
 * Scrolling between explorer pages, driven by the router's Scroll events:
 * - a new page starts at the top;
 * - a change of query only (a contract table, a dialog's state) keeps the reader where they are;
 * - Back and Forward return to the saved position, waiting for the page's data to make it tall enough.
 */
export function provideExplorerScrolling() {
  return provideEnvironmentInitializer(() => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const router = inject(Router);
    const scroller = inject(ViewportScroller);
    let lastPath: string | null = null;
    let restoring = 0;

    router.events.subscribe(event => {
      if (!(event instanceof Scroll)) return;
      const routerEvent = event.routerEvent;
      const path = pathOf("urlAfterRedirects" in routerEvent ? routerEvent.urlAfterRedirects : routerEvent.url);
      const pathChanged = lastPath !== null && path !== lastPath;
      lastPath = path;
      const attempt = ++restoring;

      if (event.position) {
        const [x, y] = event.position;
        const started = performance.now();
        const restore = () => {
          if (attempt !== restoring) return;
          const reachable = document.documentElement.scrollHeight - window.innerHeight >= y;
          window.scrollTo({ left: x, top: y, behavior: "instant" });
          if (!reachable && performance.now() - started < RESTORE_WINDOW_MS) requestAnimationFrame(restore);
        };
        requestAnimationFrame(restore);
      } else if (event.anchor) {
        scroller.scrollToAnchor(event.anchor);
      } else if (pathChanged) {
        window.scrollTo({ left: 0, top: 0, behavior: "instant" });
      }
    });
  });
}
