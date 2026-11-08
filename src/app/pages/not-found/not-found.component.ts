import { ChangeDetectionStrategy, Component, computed, inject, RESPONSE_INIT } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { DataService } from "../../services/data.service";

/** Unknown routes: say so plainly, keep search in reach, and answer crawlers with a real 404. */
@Component({
  selector: "app-not-found",
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hr-container">
      <section class="api-error" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Page not found</h1>
        <p>
          @if (chainName(); as chain) { The {{ chain }} explorer has no page at }
          @else { This explorer has no page at }
          <code class="break-all">{{ path }}</code>. Search above for an account, block, transaction ID or public key,
          or <a routerLink="/" class="link-primary">go to the home page</a>.
        </p>
      </section>
    </div>
  `
})
export class NotFoundComponent {
  private readonly data = inject(DataService);
  readonly chainName = computed(() => this.data.explorerMetadata()?.chain_name ?? "");
  readonly path = inject(Router).url.split(/[?#]/)[0];

  constructor() {
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) response.status = 404;
  }
}
