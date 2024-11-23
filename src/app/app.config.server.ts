import {ApplicationConfig, inject, mergeApplicationConfig, provideAppInitializer, REQUEST} from '@angular/core';
import {provideServerRendering} from '@angular/platform-server';
import {appConfig} from './app.config';
import {DataService, DataServiceServer} from "./services/data.service";
import {provideServerRoutesConfig} from "@angular/ssr";
import {serverRoutes} from "./app.routes";
import {provideClientHydration} from "@angular/platform-browser";
import {readFileSync} from "node:fs";
import {createContext, runInContext} from "node:vm";
import {devEnv} from "./dev.env";

async function injectCustomTheme(file: string, ds: DataService) {
  // const fsModule = await import('node:fs');
  // const vmModule = await import('node:vm');
  const themeSourceData = readFileSync(file).toString();
  // create VM context to run theme data
  const context = {themeData: {}};
  createContext(context);
  // run theme data in context
  runInContext(themeSourceData, context);
  ds.customTheme = context.themeData;
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(async () => {
      const request = inject(REQUEST);
      const ds = inject(DataService);

      let href = '';
      if (request) {
        const hyperionServer = request.headers.get('x-hyperion-server');
        if (hyperionServer) {
          href = hyperionServer;
        } else {
          href = request.headers.get('referer') ?? request.url;
        }
      }

      if (href) {
        const url = new URL(href);
        if (url.host === 'localhost:4200') {
          ds.env.hyperionApiUrl = devEnv.hyperionApiUrl;
        } else {
          ds.env.hyperionApiUrl = url.origin;
        }
      } else {
        ds.env.hyperionApiUrl = devEnv.hyperionApiUrl;
      }

      // handle custom theme override
      if (request) {
        const url = new URL(request.url);
        const themeName = url.searchParams.get('theme');
        if (themeName) {
          console.log(`Injecting ${themeName} theme...`);
          await injectCustomTheme(`./themes/${themeName}.theme.mjs`, ds);
        }
      }
    }),
    provideClientHydration(),
    provideServerRendering(),
    provideServerRoutesConfig(serverRoutes),
    {provide: DataService, useClass: DataServiceServer}
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
