import {Component, inject, PLATFORM_ID} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {DataService} from "./services/data.service";
import {toObservable} from "@angular/core/rxjs-interop";
import {isPlatformBrowser} from "@angular/common";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  ds = inject(DataService);
  platformId = inject(PLATFORM_ID);

  constructor() {
    toObservable(this.ds.ready).subscribe(ready => {
      if (ready && isPlatformBrowser(this.platformId)) {
        console.log('Data service is ready');
        const loader = document.getElementById('global-loader');
        if (loader) {
          // fade out the loader then remove
          loader.style.opacity = '0';
          setTimeout(() => loader.remove(), 300);
        }
      }
    });
  }
}
