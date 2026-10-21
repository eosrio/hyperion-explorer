import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { DataService } from "../../services/data.service";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatOption, MatSelect } from "@angular/material/select";
import { HttpClient } from "@angular/common/http";
import { lastValueFrom } from "rxjs";
import { describeApiError } from "../../api-errors";

@Component({
  selector: "app-theme-selector",
  imports: [MatFormField, MatSelect, MatOption, MatLabel],
  templateUrl: "./theme-selector.component.html",
  styleUrl: "./theme-selector.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSelectorComponent {
  readonly ds = inject(DataService);
  private readonly http = inject(HttpClient);
  readonly selectedTheme = signal("");
  readonly loading = signal(false);
  readonly error = signal("");
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
