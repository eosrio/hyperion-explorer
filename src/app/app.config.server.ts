import {
  ApplicationConfig,
  inject,
  mergeApplicationConfig,
  PLATFORM_ID,
  provideAppInitializer,
  REQUEST
} from '@angular/core';
import {provideServerRendering} from '@angular/platform-server';
import {appConfig} from './app.config';
import {DataService, DataServiceServer} from "./services/data.service";
import {provideServerRoutesConfig} from "@angular/ssr";
import {serverRoutes} from "./app.routes";
import {provideClientHydration} from "@angular/platform-browser";
import {readdirSync, readFileSync} from "node:fs";
import {createContext, runInContext} from "node:vm";

async function injectCustomTheme(file: string, ds: DataService) {
  const themeSourceData = readFileSync(file).toString();
  const context = {themeData: {}};
  createContext(context);
  runInContext(themeSourceData, context);
  ds.customTheme = context.themeData;
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(async () => {
      const request = inject(REQUEST);
      const ds = inject(DataService);

      readdirSync('./themes').forEach(file => {
        if (file.endsWith('.theme.mjs')) {
          ds.availableThemes.push(file.replace('.theme.mjs', ''));
        }
      });

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
