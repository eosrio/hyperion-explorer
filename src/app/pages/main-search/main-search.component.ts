import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { NavigationEnd, Router, RouterLink, RouterOutlet } from "@angular/router";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { debounceTime, filter, map } from "rxjs";
import { MatAutocomplete, MatAutocompleteTrigger, MatOption } from "@angular/material/autocomplete";
import { MatButton } from "@angular/material/button";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faHeart, faSearch } from "@fortawesome/free-solid-svg-icons";
import { faGithub, faTelegram } from "@fortawesome/free-brands-svg-icons";
import { DataService } from "../../services/data.service";
import { SearchService } from "../../services/search.service";
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
export class MainSearchComponent implements OnInit, OnDestroy {
  readonly dataService = inject(DataService);
  readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  readonly searchForm = inject(FormBuilder).nonNullable.group({ search_field: ["", Validators.required] });
  readonly chainData = this.dataService.explorerMetadata;
  readonly version = version;
  readonly icons = { search: faSearch, heart: faHeart, github: faGithub, telegram: faTelegram };
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
  readonly scrollProgress = signal(0);
  readonly reducedMotion = signal(isPlatformBrowser(this.platform) && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  readonly headerProgress = computed(() => (this.isHome() && !this.reducedMotion() ? this.scrollProgress() : 1));
  private scrollFrame: number | undefined;
  private searchRevision = 0;

  constructor() {
    this.searchForm.controls.search_field.valueChanges.pipe(debounceTime(200), takeUntilDestroyed()).subscribe(async value => {
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
    afterNextRender(() => this.updateScroll());
  }
  ngOnInit(): void {
    if (this.dataService.routeError) {
      this.err.set(this.dataService.routeError);
      this.dataService.routeError = "";
    }
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
      this.err.set("Enter an account, block number, transaction ID, or public key.");
      this.searchFieldRef()?.nativeElement.focus();
      return;
    }
    const suggestions = this.filteredAccounts();
    if (!this.searchService.submitSearch(value, suggestions)) {
      this.err.set(`No results for ${value}`);
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
