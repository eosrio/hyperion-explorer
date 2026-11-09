import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { SearchService } from "../../services/search.service";

/**
 * One shape for every failed lookup (account, transaction, block, key): a heading that names what was not found,
 * the reason in plain words, and the ways forward. "Edit search" puts the query back in the search field.
 */
@Component({
  selector: "app-lookup-error",
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="api-error lookup-error" [attr.role]="retryable() ? 'alert' : 'status'" aria-labelledby="lookup-error-title">
      <h1 id="lookup-error-title">{{ heading() }}</h1>
      <p>{{ message() }}</p>
      <ng-content />
      <div class="lookup-actions">
        @if (retryable()) { <button type="button" (click)="retry.emit()">Try again</button> }
        @if (query()) { <button type="button" (click)="editSearch()">Edit search</button> }
        <a routerLink="/">Explorer home</a>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .lookup-error {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
    }
    .lookup-error h1 {
      overflow-wrap: anywhere;
    }
    .lookup-error p {
      max-width: 70ch;
      color: var(--main-text);
    }
    .lookup-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
      margin-top: 0.25rem;
    }
    .lookup-actions a,
    ::ng-deep .lookup-link {
      color: var(--primary);
      font-weight: 600;
      text-decoration: none;
    }
    .lookup-actions a:hover,
    ::ng-deep .lookup-link:hover {
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }
    .lookup-actions a:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
      border-radius: 0.25rem;
    }
  `
})
export class LookupErrorComponent {
  private readonly search = inject(SearchService);
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  /** The text the visitor searched for, offered back for correction. */
  readonly query = input<string>("");
  readonly retryable = input(false);
  readonly retry = output<void>();

  editSearch(): void {
    this.search.editQuery(this.query());
  }
}
