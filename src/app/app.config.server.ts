import {ApplicationConfig, mergeApplicationConfig} from '@angular/core';
import {provideServerRendering} from '@angular/platform-server';
import {appConfig} from './app.config';
import {DataService, DataServiceServer} from "./services/data.service";
import {provideServerRoutesConfig} from "@angular/ssr";
import {serverRoutes} from "./app.routes";
import {provideClientHydration} from "@angular/platform-browser";

const serverConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
    provideServerRendering(),
    provideServerRoutesConfig(serverRoutes),
    {provide: DataService, useClass: DataServiceServer}
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
