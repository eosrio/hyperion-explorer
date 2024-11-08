import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection,
  inject,
  provideAppInitializer
} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {provideClientHydration} from '@angular/platform-browser';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideHttpClient, withFetch} from "@angular/common/http";
import {DataService, DataServiceBrowser} from "./services/data.service";

async function initApp() {
  console.log("Initializing app...");
  const ds = inject(DataService);
  await ds.load();
  console.log(ds.explorerMetadata);
  console.log("App initialized!");
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
