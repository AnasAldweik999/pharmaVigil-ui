import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { extractErrorMessage } from '../../../core/utils/api-error.util';
import { usernameValidators } from '../../../core/validators/username.validator';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthBrandPanelComponent } from '../../../shared/auth-brand-panel/auth-brand-panel.component';
import { AuthMobileHeroComponent } from '../../../shared/auth-mobile-hero/auth-mobile-hero.component';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-setup-username',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AuthBrandPanelComponent, AuthMobileHeroComponent, LanguageSwitcherComponent],
  templateUrl: './setup-username.component.html',
})
export class SetupUsernameComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  readonly translation = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly setupToken = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    username: ['', usernameValidators],
  });

  ngOnInit(): void {
    this.setupToken.set(this.route.snapshot.queryParamMap.get('token'));
  }

  onSubmit(): void {
    if (this.form.invalid || !this.setupToken()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.setupUsername(this.setupToken()!, this.form.getRawValue().username).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigate([res.accountType === 'SUPERVISOR' ? '/supervisor/dashboard' : '/staff/reports']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v)));
      },
    });
  }

  get usernameControl() {
    return this.form.controls.username;
  }
}
