import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Not every supervisor role lands on the dashboard — someone whose only role
// is e.g. USERS_MANAGER still has a legitimate section to land on, it's just
// not under /dashboard. Returns null only once none of the known sections
// match, i.e. the account genuinely has no accessible section.
function resolveSupervisorLanding(authService: AuthService, router: Router): UrlTree | null {
  if (authService.hasRole('DASHBOARD_VIEWER')) {
    return router.createUrlTree(['/supervisor/dashboard/production-overview']);
  }
  if (authService.hasRole('REPORTS_MANAGER')) {
    return router.createUrlTree(['/supervisor/dashboard/reports']);
  }
  if (authService.hasRole('USERS_MANAGER')) {
    return router.createUrlTree(['/supervisor/users']);
  }
  if (authService.hasRole('PRODUCTS_MANAGER')) {
    return router.createUrlTree(['/supervisor/products']);
  }
  if (authService.hasRole('DEPARTMENTS_MANAGER')) {
    return router.createUrlTree(['/supervisor/departments']);
  }
  if (authService.hasRole('BATCH_TRACKING_MANAGER')) {
    return router.createUrlTree(['/supervisor/batches']);
  }
  if (authService.hasRole('MACHINE_MANAGER')) {
    return router.createUrlTree(['/supervisor/machines']);
  }
  if (authService.hasRole('STOP_TYPES_MANAGER')) {
    return router.createUrlTree(['/supervisor/stop-types']);
  }
  if (authService.hasRole('SHIFT_MANAGER')) {
    return router.createUrlTree(['/supervisor/shifts']);
  }
  return null;
}

export const dashboardLandingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return resolveSupervisorLanding(authService, router) ?? router.createUrlTree(['/supervisor/no-access']);
};

// Guards /supervisor/no-access itself: someone who actually has a role (and
// just typed/bookmarked the URL) gets redirected to where they belong instead
// of seeing a "no permissions" page they don't deserve. Only a genuinely
// zero-role account is allowed to render it.
export const supervisorNoAccessGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return resolveSupervisorLanding(authService, router) ?? true;
};
