import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { getPasswordRules, passwordValidator, PasswordRule } from '../../../core/validators/password.validator';
import { extractErrorMessage } from '../../../core/utils/api-error.util';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthBrandPanelComponent } from '../../../shared/auth-brand-panel/auth-brand-panel.component';
import { AuthMobileHeroComponent } from '../../../shared/auth-mobile-hero/auth-mobile-hero.component';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AuthBrandPanelComponent, AuthMobileHeroComponent, LanguageSwitcherComponent],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  readonly translation = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly loading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly showNewPassword     = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly resetForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, passwordValidator]],
    confirmPassword: ['', Validators.required],
  });

  get newPasswordRules(): PasswordRule[] {
    return getPasswordRules(this.newPasswordControl.value ?? '');
  }

  ngOnInit(): void {
    const tokenParam = this.route.snapshot.queryParamMap.get('token');
    this.token.set(tokenParam);
  }

  onForgotSubmit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.forgotPassword(this.forgotForm.getRawValue().email).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set(this.translation.t('auth.resetPassword.forgotSuccess'));
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v)));
      },
    });
  }

  onResetSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const { newPassword, confirmPassword } = this.resetForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.errorMessage.set(this.translation.t('auth.resetPassword.validation.passwordsMismatch'));
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.resetPassword(this.token()!, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set(this.translation.t('auth.resetPassword.resetSuccess'));
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v)));
      },
    });
  }

  get emailControl() {
    return this.forgotForm.controls.email;
  }

  get newPasswordControl() {
    return this.resetForm.controls.newPassword;
  }

  get confirmPasswordControl() {
    return this.resetForm.controls.confirmPassword;
  }
}
