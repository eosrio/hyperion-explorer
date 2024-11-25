import {DataService} from "./services/data.service";
import {isPlatformBrowser} from "@angular/common";

declare const DEV_MODE: boolean;
declare const HYP_API_URL: string;

export async function defineOrigin(ds: DataService, request: Request | null, platform: Object): Promise<void> {
  let apiUrl = '';
  // replace API URL with dev environment or build time env
  if (DEV_MODE) {
    if (HYP_API_URL === 'devEnv') {
      apiUrl = (await import('./dev.env')).devEnv.hyperionApiUrl;
    } else {
      apiUrl = HYP_API_URL;
    }
  } else {
    // production mode use the current origin as the API URL unless its overridden by the server
    if (HYP_API_URL) {
      apiUrl = HYP_API_URL;
    } else {
      // if there is a request object it means its being executed on the server
      if (request) {
        const hyperionServer = request.headers.get('x-hyperion-server');
        if (hyperionServer) {
          // this means its being served by hyperion
          console.log(`[${platform}] Using Hyperion server:`, hyperionServer);
          ds.setOrigin(hyperionServer);
          apiUrl = hyperionServer;
        } else {
          // this means its being server standalone
          console.log(`[${platform}] Using referer:`, request.headers.get('referer'));
          apiUrl = request.headers.get('referer') ?? request.url;
        }
      } else {
        if (isPlatformBrowser(platform)) {
          apiUrl = location.href;
        }
      }
    }
  }
  ds.setOrigin(apiUrl, platform.toString());
}
