import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideExperimentalZonelessChangeDetection, REQUEST
} from '@angular/core';
import {provideRouter, Router} from '@angular/router';

import {routes} from './app.routes';
import {provideClientHydration, withIncrementalHydration} from '@angular/platform-browser';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {provideHttpClient, withFetch} from "@angular/common/http";
import {DataService, DataServiceBrowser} from "./services/data.service";
import {isPlatformBrowser} from "@angular/common";

async function injectCustomTheme(file: string, ds: DataService) {

  const fsModule = await import('node:fs');
  const vmModule = await import('node:vm');

  const themeSourceData = fsModule.readFileSync(file).toString();
  // create VM context to run theme data
  const context = {themeData: {}};
  vmModule.createContext(context);
  // run theme data in context
  vmModule.runInContext(themeSourceData, context);
  if (ds.explorerMetadata) {
    ds.explorerMetadata.theme = context.themeData;
  }
}

async function initApp(): Promise<void> {
  const request = inject(REQUEST);
  const ds = inject(DataService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  await ds.load();
  if (!ds.explorerMetadata) {
    console.error(`[${platformId}] Error loading explorer metadata:`, ds.initError);
    ds.ready.set(true);
    await router.navigate(['/error']);
  } else {
    console.log(`[${platformId}] Explorer metadata loaded for ${ds.explorerMetadata.chain_name}:`, ds.explorerMetadata.chain_id);
    if (isPlatformBrowser(platformId)) {
      await ds.activateTheme();
    } else {

      // handle custom theme override
      if (request) {
        const url = new URL(request.url);
        const themeName = url.searchParams.get('theme');
        if (themeName) {
          console.log(`Injecting ${themeName} theme...`);
          await injectCustomTheme(`./themes/${themeName}.theme.mjs`, ds);
        }
      }

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
    provideHttpClient(withFetch())
  ]
};
