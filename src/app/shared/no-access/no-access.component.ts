import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../pipes/translate.pipe';

const SESSION_CHECK_INTERVAL_MS = 20000;

@Component({
  selector: 'app-no-access',
  imports: [TranslatePipe],
  templateUrl: './no-access.component.html',
})
export class NoAccessComponent {
  private readonly authService = inject(AuthService);

  constructor() {
    // This page makes no API calls of its own, so it would never notice a
    // backend user update — which invalidates the session and normally
    // triggers an automatic logout the next time any request 401s. Poll a
    // lightweight endpoint here so an account that gets roles assigned from
    // another session while sitting on this page still gets logged out
    // (matching the existing behavior everywhere else) instead of being
    // stuck until the user manually signs out and back in.
    interval(SESSION_CHECK_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.authService.refreshToken().subscribe({
          error: () => this.authService.logout(),
        });
      });
  }
}
