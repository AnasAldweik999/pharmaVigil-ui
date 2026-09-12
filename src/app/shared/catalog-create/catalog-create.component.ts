import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CatalogCreateConfig } from './catalog-create.models';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';

interface CreatedItem {
  id: string;
  name: string;
  createdAt: string;
}

@Component({
  selector: 'app-catalog-create',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './catalog-create.component.html',
})
export class CatalogCreateComponent implements OnInit {
  @Input({ required: true }) config!: CatalogCreateConfig;

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
  });

  get nameControl() {
    return this.form.controls.name;
  }

  ngOnInit(): void {
    this.form.controls.name.setValidators([Validators.required, Validators.minLength(this.config.minLength)]);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const { name } = this.form.getRawValue();
    this.http.post<CreatedItem>(this.config.endpoint, { name }).subscribe({
      next: (item) => {
        this.submitting.set(false);
        this.toastService.success(this.translation.t(this.config.createdMessageKey, { name: item.name }));
        this.router.navigateByUrl(this.config.backRoute);
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }
}
