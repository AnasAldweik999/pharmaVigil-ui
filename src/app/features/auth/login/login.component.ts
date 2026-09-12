import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { environment } from '../../../../environments/environment.staff';
import { extractErrorMessage } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthBrandPanelComponent } from '../../../shared/auth-brand-panel/auth-brand-panel.component';
import { AuthMobileHeroComponent } from '../../../shared/auth-mobile-hero/auth-mobile-hero.component';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AuthBrandPanelComponent, AuthMobileHeroComponent, LanguageSwitcherComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    usernameOrEmail: ['', Validators.required],
    password: ['', Validators.required],
  });

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly showPassword = signal(false);

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    const { usernameOrEmail, password } = this.form.getRawValue();

    this.authService.login(usernameOrEmail, password, environment.portalType).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.requiresUsernameSetup) {
          this.router.navigate(['/setup-username'], { queryParams: { token: res.setupToken } });
          return;
        }
        if (res.accountType === 'SUPERVISOR') {
          this.router.navigate(['/supervisor/dashboard']);
        } else {
          this.router.navigate(['/staff/reports']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'genericAuth', (v) => this.translation.violatorLabel(v)));
      },
    });
  }

  get usernameOrEmailControl() {
    return this.form.controls.usernameOrEmail;
  }

  get passwordControl() {
    return this.form.controls.password;
  }
}
