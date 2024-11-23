import {
  ApplicationConfig,
  inject, PLATFORM_ID,
  provideAppInitializer,
  provideExperimentalZonelessChangeDetection
} from '@angular/core';
import {provideRouter, Router} from '@angular/router';

import {routes} from './app.routes';
import {provideClientHydration, withIncrementalHydration} from '@angular/platform-browser';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideHttpClient, withFetch} from "@angular/common/http";
import {DataService, DataServiceBrowser} from "./services/data.service";

async function initApp() {
  const ds = inject(DataService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  await ds.load();
  if (!ds.explorerMetadata) {
    console.error(`[${platformId}] Error loading explorer metadata:`, ds.initError);
    await router.navigate(['/error']);
  } else {
    console.log(`[${platformId}] Explorer metadata loaded for ${ds.explorerMetadata.chain_name}:`, ds.explorerMetadata.chain_id);
  }
  return ds;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideExperimentalZonelessChangeDetection(),
    provideClientHydration(withIncrementalHydration()),
    {provide: DataService, useClass: DataServiceBrowser},
    provideAppInitializer(initApp),
    provideAnimationsAsync(),
    provideHttpClient(withFetch())
  ]
};
