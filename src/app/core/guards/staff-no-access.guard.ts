import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Guards /staff/no-access itself: someone who actually has FIELD_REPORTER
// (and just typed/bookmarked the URL) gets sent back to their reports list
// instead of seeing a "no permissions" page they don't deserve.
export const staffNoAccessGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.hasRole('FIELD_REPORTER')) {
    return router.createUrlTree(['/staff/reports']);
  }
  if (authService.hasRole('BATCH_LOG_REPORTER')) {
    return router.createUrlTree(['/staff/batches']);
  }
  return true;
};
