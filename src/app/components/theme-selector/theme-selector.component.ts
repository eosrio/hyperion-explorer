import {Component, effect, inject, signal} from '@angular/core';
import {DataService} from "../../services/data.service";
import {MatFormField, MatLabel} from "@angular/material/form-field";
import {MatOption, MatSelect} from "@angular/material/select";
import {rxResource} from "@angular/core/rxjs-interop";
import {HttpClient} from "@angular/common/http";
import {Observable, of} from "rxjs";

@Component({
  selector: 'app-theme-selector',
  imports: [
    MatFormField,
    MatSelect,
    MatOption,
    MatLabel
  ],
  templateUrl: './theme-selector.component.html',
  styleUrl: './theme-selector.component.css'
})
export class ThemeSelectorComponent {
  ds = inject(DataService);
  http = inject(HttpClient);

  selectedTheme = signal('');

  themeData = rxResource<any, { theme: string }>({
    request: () => {
      return {theme: this.selectedTheme()}
    },
    loader: (params) => {
      if (params.request.theme === 'UNSET_THEME') {
        window.location.href = window ? window.location.origin : '/';
        return of({} as any);
      }
      if (!params.request.theme) {
        return of({} as any);
      } else {
        return this.http.get('/.internal/read_theme/' + params.request.theme) as Observable<any>;
      }
    }
  });

  constructor() {
    effect(() => {
      if (this.ds.explorerMetadata) {
        this.ds.explorerMetadata.theme = this.themeData.value();
        this.ds.activateTheme().then(() => {
          localStorage.setItem('theme-override', JSON.stringify(this.ds.explorerMetadata?.theme || {}));
        }).catch(console.error);
      }
    });
  }
}
