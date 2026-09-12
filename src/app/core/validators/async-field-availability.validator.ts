import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';
import { UserFieldAvailabilityResponse } from '../models/user.models';

export type AvailabilityCheckFn = (value: string, excludeId?: string) => Observable<UserFieldAvailabilityResponse>;

export function asyncFieldAvailabilityValidator(
  checkFn: AvailabilityCheckFn,
  excludeId?: string,
  debounceMs = 300
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    // Skip the network round-trip for values the user hasn't actually touched yet —
    // a freshly-loaded control (e.g. a user's existing username/email on the edit
    // page) is never dirty until they interact with it.
    if (!control.dirty) return of(null);
    const value = control.value as string;
    if (!value) return of(null);
    return timer(debounceMs).pipe(
      switchMap(() => checkFn(value, excludeId)),
      map((res) => (res.available ? null : { taken: true })),
      catchError(() => of(null))
    );
  };
}
