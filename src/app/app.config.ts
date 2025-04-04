import {
  ApplicationConfig,
  importProvidersFrom, // Import importProvidersFrom
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideExperimentalZonelessChangeDetection,
  REQUEST
} from '@angular/core';
import {provideRouter, Router} from '@angular/router';

import {routes} from './app.routes';
import {provideClientHydration, withIncrementalHydration} from '@angular/platform-browser';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideHttpClient, withFetch} from "@angular/common/http";
import {DataService, DataServiceBrowser} from "./services/data.service";
import {isPlatformBrowser} from "@angular/common";
import {defineOrigin} from "./origin-config";
import { NgxEchartsModule } from 'ngx-echarts'; // Import NgxEchartsModule

// Removed global echarts.use() - NgxEchartsModule.forRoot handles it


async function initApp(): Promise<void> {
  const ds = inject(DataService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const request = inject(REQUEST);

  await defineOrigin(ds, request, platformId);
  await ds.load();

  if (!ds.explorerMetadata && ds.env.hyperionApiUrl) {
    console.error(`[${platformId}] Error loading explorer metadata:`, ds.initError);
    ds.ready.set(true);
    await router.navigate(['/error']);
  } else {
    if (isPlatformBrowser(platformId)) {
      await ds.activateTheme();
    } else {
      ds.ready.set(true);
    }
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideExperimentalZonelessChangeDetection(),
    provideClientHydration(withIncrementalHydration()),
    {provide: DataService, useClass: DataServiceBrowser},
    provideAppInitializer(initApp),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),
    // Provide NgxEchartsModule globally
    importProvidersFrom(NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    }))
  ]
};
