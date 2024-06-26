import {APP_INITIALIZER, ApplicationConfig, provideExperimentalZonelessChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {provideClientHydration} from '@angular/platform-browser';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from "@angular/common/http";
import {DataService, DataServiceBrowser} from "./services/data.service";

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    // provideClientHydration(),
    {
      provide: DataService,
      useClass: DataServiceBrowser
    },
    {
      provide: APP_INITIALIZER,
      deps: [DataService],
      useFactory: (ds: DataService) => async () => await ds.load(),
      multi: true
    },
    provideAnimationsAsync(),
    provideHttpClient(withFetch())
  ]
};
