import {ActivatedRouteSnapshot, CanActivateFn, Router} from '@angular/router';
import {inject} from "@angular/core";
import {DataService} from "../services/data.service";

export const accountNameGuard: CanActivateFn = async (route: ActivatedRouteSnapshot): Promise<boolean> => {
  const ds = inject(DataService);
  const router = inject(Router);
  const valid = !!route.params['account_name'].match(/^[a-z1-5.]{0,13}$/);
  if (valid) {
    return true;
  } else {
    console.error('Invalid account name:', route.params['account_name']);
    ds.routeError = `${route.params['account_name']} is not a valid account name`;
    await router.navigate(['/']);
    return false;
  }
};
