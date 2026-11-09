import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal, viewChild } from "@angular/core";
import { DataService } from "../../services/data.service";
import { MatOption, MatSelect } from "@angular/material/select";
import { HttpClient } from "@angular/common/http";
import { lastValueFrom } from "rxjs";
import { describeApiError } from "../../api-errors";

@Component({
  selector: "app-theme-selector",
  imports: [MatSelect, MatOption],
  templateUrl: "./theme-selector.component.html",
  styleUrl: "./theme-selector.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSelectorComponent {
  readonly ds = inject(DataService);
  private readonly http = inject(HttpClient);
  readonly selectedTheme = signal("CURRENT_THEME");
  readonly loading = signal(false);
  readonly error = signal("");
  private readonly themeSelect = viewChild<MatSelect>("themeSelect");

  constructor() {
    // Opening the panel from the footer moves focus to the choice it offers.
    afterNextRender(() => this.themeSelect()?.focus());
  }

  /** Theme files are named by id ("xpr"); show the name a visitor recognises, which starts with that id. */
  themeLabel(id: string): string {
    const known: Record<string, string> = { qry: "QRY", wax: "WAX", xpr: "XPR Network", eos: "EOS", ux: "UX Network" };
    return known[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
  }
  async selectTheme(name: string): Promise<void> {
    this.selectedTheme.set(name);
    this.loading.set(true);
    this.error.set("");
    try {
      const theme =
        name === "UNSET_THEME"
          ? null
          : await lastValueFrom(this.http.get<Record<string, string>>(`/.internal/read_theme/${encodeURIComponent(name)}`));
      if (theme && !Object.entries(theme).every(([key, value]) => key.startsWith("--") && typeof value === "string"))
        throw new Error("This theme contains invalid CSS variables.");
      await this.ds.setThemeOverride(theme);
    } catch (error) {
      this.error.set(describeApiError(error));
    } finally {
      this.loading.set(false);
    }
  }
}
