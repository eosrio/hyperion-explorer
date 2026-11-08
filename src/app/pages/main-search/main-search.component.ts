import { previewLabel } from "../../preview-label";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
  viewChild
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { NavigationEnd, Router, RouterLink, RouterOutlet } from "@angular/router";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { debounceTime, filter, map, tap } from "rxjs";
import { MatAutocomplete, MatAutocompleteTrigger, MatOption } from "@angular/material/autocomplete";
import { MatButton } from "@angular/material/button";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faHeart, faSearch, faCircleQuestion, faCircleExclamation, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { faGithub, faTelegram } from "@fortawesome/free-brands-svg-icons";
import { DataService } from "../../services/data.service";
import { SearchService, invalidAccountMessage } from "../../services/search.service";
import { ThemeSelectorComponent } from "../../components/theme-selector/theme-selector.component";
import { version } from "../../../../package.json";

@Component({
  selector: "app-layout-animation-test",
  imports: [
    ReactiveFormsModule,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatButton,
    FaIconComponent,
    RouterLink,
    RouterOutlet,
    ThemeSelectorComponent
  ],
  templateUrl: "./main-search.component.html",
  styleUrl: "./main-search.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainSearchComponent implements OnDestroy {
  readonly dataService = inject(DataService);
  readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  readonly searchForm = inject(FormBuilder).nonNullable.group({ search_field: [{ value: "", disabled: true }, Validators.required] });
  readonly searchReady = signal(false);
  readonly chainData = this.dataService.explorerMetadata;
  readonly historyCoverage = resource({
    loader: async () => {
      try {
        const response = await fetch(this.dataService.env.hyperionApiUrl + "/v2/health", { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return { state: "unknown" as const };
        const health: unknown = await response.json();
        if (!health || typeof health !== "object" || !Array.isArray((health as any).health)) return { state: "unknown" as const };
        const elastic = (health as any).health.filter((entry: any) => entry?.service === "Elasticsearch");
        if (elastic.length !== 1 || elastic[0].status === "Error") return { state: "unknown" as const };
        const data = elastic[0].service_data, missing = data?.missing_blocks;
        if (!Number.isSafeInteger(missing) || missing < 0) return { state: "unknown" as const };
        if (missing === 0) return { state: "no-reported-gaps" as const };
        const pct = typeof data.missing_pct === "string" && /^(?:100(?:\.0{1,2})?|[0-9]{1,2}(?:\.[0-9]{1,2})?)%$/.test(data.missing_pct)
          ? data.missing_pct : null;
        return { state: "missing" as const, missing, pct };
      } catch {
        return { state: "unknown" as const };
      }
    }
  });

  readonly logoFailed = signal(false);
  readonly logoUrl = computed(() =>
    this.logoFailed() ? "assets/logo-hyperion-horz.svg" : this.chainData()?.logo || "assets/logo-hyperion-horz.svg"
  );
  readonly version = version;
  readonly previewLabel = previewLabel;
  readonly icons = {
    help: faCircleQuestion,
    refresh: faRotateRight,
    error: faCircleExclamation,
    search: faSearch,
    heart: faHeart,
    github: faGithub,
    telegram: faTelegram
  };
  readonly searchFieldRef = viewChild<ElementRef<HTMLInputElement>>("searchFieldRef");
  readonly autocomplete = viewChild(MatAutocompleteTrigger);
  readonly filteredAccounts = signal<string[]>([]);
  readonly validSearch = signal(false);
  readonly err = signal("");
  readonly showThemeSelector = signal(false);
  readonly routeUrl = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );
  readonly isHome = computed(() => this.routeUrl().split("?")[0] === "/");

  /** The skip link moves focus without touching the route (a bare #fragment would resolve against the base href). */
  skipToContent(event: Event): void {
    event.preventDefault();
    const main = document.getElementById("main-content");
    main?.focus();
    main?.scrollIntoView({ block: "start" });
  }
  readonly scrollProgress = signal(0);
  readonly reducedMotion = signal(isPlatformBrowser(this.platform) && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  readonly headerProgress = computed(() => (this.isHome() && !this.reducedMotion() ? this.scrollProgress() : 1));
  private scrollFrame: number | undefined;
  private searchRevision = 0;

  constructor() {
    // The account route guard sends rejected names here; keep the text and explain the problem.
    effect(() => {
      const rejected = this.router.parseUrl(this.routeUrl()).queryParams["invalid_account"];
      if (typeof rejected !== "string" || !rejected) return;
      untracked(() => {
        this.searchForm.controls.search_field.setValue(rejected, { emitEvent: false });
        this.err.set(invalidAccountMessage(rejected));
      });
    });
    effect(() => {
      this.chainData()?.logo;
      this.logoFailed.set(false);
    });
    this.searchForm.controls.search_field.valueChanges
      .pipe(
        tap(() => this.err.set("")),
        debounceTime(200),
        takeUntilDestroyed()
      )
      .subscribe(async value => {
        const revision = ++this.searchRevision;
        const text = value.trim();
        this.validSearch.set(text.length > 0 && this.searchService.submitSearch(text, []));
        if (text.length < 3 || text.length > 12) {
          this.filteredAccounts.set([]);
          return;
        }
        const accounts = await this.searchService.filterAccountNames(text);
        if (!this.destroyRef.destroyed && revision === this.searchRevision) this.filteredAccounts.set(accounts);
      });
    afterNextRender(() => {
      this.searchForm.controls.search_field.enable({ emitEvent: false });
      this.searchReady.set(true);
      this.updateScroll();
    });
  }
  @HostListener("window:scroll") onScroll(): void {
    if (this.scrollFrame !== undefined || !isPlatformBrowser(this.platform)) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = undefined;
      this.updateScroll();
    });
  }
  private updateScroll(): void {
    if (isPlatformBrowser(this.platform)) this.scrollProgress.set(Math.min(1, Math.max(0, window.scrollY / 160)));
  }
  @HostListener("window:keydown", ["$event"]) onKeyPressed(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      this.searchFieldRef()?.nativeElement.focus();
    }
  }
  async submit(): Promise<void> {
    const value = this.searchForm.controls.search_field.value.trim();
    if (!value) {
      this.err.set("Enter an account, block, transaction ID or public key.");
      this.searchFieldRef()?.nativeElement.focus();
      return;
    }
    const suggestions = this.filteredAccounts();
    if (!this.searchService.submitSearch(value, suggestions)) {
      // Short single words were almost certainly meant as account names; say what is wrong with them.
      this.err.set(value.length <= 13 && !/\s/.test(value) ? invalidAccountMessage(value) : "Search format not recognized. Check the search help.");
      this.searchFieldRef()?.nativeElement.focus();
      return;
    }
    this.err.set("");
    this.filteredAccounts.set([]);
    this.autocomplete()?.closePanel();
    await this.router.navigateByUrl(`/${this.searchService.searchType()}/${encodeURIComponent(this.searchService.searchQuery())}`);
    this.searchForm.reset();
    this.validSearch.set(false);
    if (isPlatformBrowser(this.platform)) window.scrollTo({ top: 0, behavior: "instant" });
  }
  ngOnDestroy(): void {
    ++this.searchRevision;
    if (this.scrollFrame !== undefined) cancelAnimationFrame(this.scrollFrame);
  }
}
