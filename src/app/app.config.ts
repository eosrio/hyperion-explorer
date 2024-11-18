import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection,
  inject,
  provideAppInitializer
} from '@angular/core';
import {provideRouter, Router} from '@angular/router';

import {routes} from './app.routes';
import {provideClientHydration} from '@angular/platform-browser';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideHttpClient, withFetch} from "@angular/common/http";
import {DataService, DataServiceBrowser} from "./services/data.service";

async function initApp() {
  const ds = inject(DataService);
  const router = inject(Router);
  await ds.load();
  if (!ds.explorerMetadata) {
    await router.navigate(['/error']);
  }
  return ds;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(),
    {
      provide: DataService,
      useClass: DataServiceBrowser
    },
    provideAppInitializer(initApp),
    provideAnimationsAsync(),
    provideHttpClient(withFetch())
  ]
};
