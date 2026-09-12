import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { CreateShiftRequest, ShiftItem } from '../../../../core/models/catalog.models';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-shift-create',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './shift-create.component.html',
})
export class ShiftCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly endpoint = `${environment.apiUrl}/api/supervisor/shifts`;

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
  });

  get nameControl() {
    return this.form.controls.name;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translation.t('shifts.fixRequiredFields'));
      return;
    }
    this.submitting.set(true);
    const body: CreateShiftRequest = this.form.getRawValue();
    this.http.post<ShiftItem>(this.endpoint, body).subscribe({
      next: (item) => {
        this.submitting.set(false);
        this.toastService.success(this.translation.t('shifts.createdSuccess', { name: item.name }));
        this.router.navigateByUrl('/supervisor/shifts');
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }
}
