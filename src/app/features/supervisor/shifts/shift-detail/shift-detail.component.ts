import { Component, ViewChild, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { ShiftItem, UpdateShiftRequest } from '../../../../core/models/catalog.models';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';
import { extractErrorMessage } from '../../../../core/utils/api-error.util';

@Component({
  selector: 'app-shift-detail',
  imports: [ReactiveFormsModule, RouterLink, NgClass, ConfirmModalComponent, TranslatePipe],
  templateUrl: './shift-detail.component.html',
})
export class ShiftDetailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly endpoint = `${environment.apiUrl}/api/supervisor/shifts`;

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;
  private pendingAction: 'save' | 'toggleActive' | null = null;

  readonly loading        = signal(true);
  readonly notFound       = signal(false);
  readonly saving         = signal(false);
  readonly togglingActive = signal(false);

  readonly shift = signal<ShiftItem | null>(null);

  form = this.buildForm(null);

  get nameControl() { return this.form.get('name')!; }

  get confirmModalTitle(): string {
    const item = this.shift();
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChanges');
      case 'toggleActive': return item?.active ? t('shifts.deactivateShift') : t('shifts.activateShift');
      default: return t('grid.confirm');
    }
  }
  get confirmModalLabel(): string {
    const item = this.shift();
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChangesLower');
      case 'toggleActive': return item?.active ? t('users.deactivate') : t('users.activate');
      default: return t('grid.confirm');
    }
  }
  get confirmModalBtnClass(): string {
    const item = this.shift();
    switch (this.pendingAction) {
      case 'toggleActive': return item?.active ? 'btn-danger' : 'btn-success';
      default: return 'btn-primary';
    }
  }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadShift(id);
    });
  }

  private loadShift(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.http.get<ShiftItem>(`${this.endpoint}/${id}`).subscribe({
      next: (item) => {
        this.shift.set(item);
        this.form = this.buildForm(item);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  private buildForm(item: ShiftItem | null) {
    return this.fb.nonNullable.group({
      name: [item?.name ?? '', [Validators.required, Validators.minLength(1)]],
    });
  }

  discardChanges(): void {
    const item = this.shift();
    if (!item) return;
    this.form = this.buildForm(item);
  }

  requestSave(): void {
    if (!this.shift() || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('shifts.fixRequiredFields'));
      return;
    }
    this.pendingAction = 'save';
    this.confirmModalCmp.open(this.translation.t('shifts.saveConfirm'));
  }

  requestToggleActive(): void {
    const item = this.shift();
    if (!item) return;
    this.pendingAction = 'toggleActive';
    const message = item.active
      ? this.translation.t('shifts.deactivateConfirm', { name: item.name })
      : this.translation.t('shifts.activateConfirm', { name: item.name });
    this.confirmModalCmp.open(message);
  }

  onConfirmModalConfirmed(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    switch (action) {
      case 'save': this.saveChanges(); break;
      case 'toggleActive': this.toggleActive(); break;
    }
  }

  private saveChanges(): void {
    const item = this.shift();
    if (!item || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('shifts.fixRequiredFields'));
      return;
    }

    const body: UpdateShiftRequest = this.form.getRawValue();
    this.saving.set(true);

    this.http.put<ShiftItem>(`${this.endpoint}/${item.id}`, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.shift.set(updated);
        this.form = this.buildForm(updated);
        this.toastService.success(this.translation.t('shifts.updateSuccess', { name: updated.name }));
      },
      error: (err) => {
        this.saving.set(false);
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
      },
    });
  }

  private toggleActive(): void {
    const item = this.shift();
    if (!item) return;
    this.togglingActive.set(true);
    this.http.patch<ShiftItem>(`${this.endpoint}/${item.id}/active`, {}).subscribe({
      next: (updated) => {
        this.togglingActive.set(false);
        this.shift.set(updated);
        this.toastService.success(
          updated.active
            ? this.translation.t('shifts.activatedSuccess', { name: updated.name })
            : this.translation.t('shifts.deactivatedSuccess', { name: updated.name })
        );
      },
      error: () => this.togglingActive.set(false),
    });
  }
}
