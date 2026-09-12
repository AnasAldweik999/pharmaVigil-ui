import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AccountType, UserRole } from '../models/user.models';
import { environment } from '../../../environments/environment.staff';

// fileReplacements swaps which environment.*.ts backs this import per build,
// and each one narrows portalType to its own literal via `as const` — widen
// it here so comparing against the other portal's literal doesn't trip
// TS2367 ("no overlap") in whichever build didn't produce that literal.
const portalType: AccountType = environment.portalType;

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const requiredRoles = (route.data['roles'] as UserRole[] | undefined) ?? [];

  if (requiredRoles.length === 0 || authService.hasAnyRole(...requiredRoles)) {
    return true;
  }

  // Missing a specific permission isn't the same as being signed out — send
  // the user to their portal's no-access page instead of back to /login,
  // which would misleadingly look like the login itself failed.
  const noAccessPath = (portalType as string) === 'STAFF' ? '/staff/no-access' : '/supervisor/no-access';
  return router.createUrlTree([noAccessPath]);
};
