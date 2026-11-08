import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { inject } from "@angular/core";
import { isValidAccountName } from "../services/search.service";

/**
 * Invalid names go back to search with the rejected text in the URL, so the message survives
 * a server-side redirect and the search field can show what was typed.
 */
export const accountNameGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const name = String(route.params["account_name"] ?? "");
  if (isValidAccountName(name)) return true;
  return inject(Router).createUrlTree(["/"], { queryParams: { invalid_account: name.slice(0, 64) } });
};
