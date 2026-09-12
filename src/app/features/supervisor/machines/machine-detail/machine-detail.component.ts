import { Component, ViewChild, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { CatalogItem, UpdateCatalogRequest } from '../../../../core/models/catalog.models';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';
import { extractErrorMessage } from '../../../../core/utils/api-error.util';

@Component({
  selector: 'app-machine-detail',
  imports: [ReactiveFormsModule, RouterLink, NgClass, ConfirmModalComponent, TranslatePipe],
  templateUrl: './machine-detail.component.html',
})
export class MachineDetailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly endpoint = `${environment.apiUrl}/api/supervisor/machines`;

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;
  private pendingAction: 'save' | 'toggleActive' | null = null;

  readonly loading        = signal(true);
  readonly notFound       = signal(false);
  readonly saving         = signal(false);
  readonly togglingActive = signal(false);

  readonly machine = signal<CatalogItem | null>(null);

  form = this.buildForm(null);

  get nameControl() { return this.form.get('name')!; }

  get confirmModalTitle(): string {
    const item = this.machine();
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChanges');
      case 'toggleActive': return item?.active ? t('machines.deactivateMachine') : t('machines.activateMachine');
      default: return t('grid.confirm');
    }
  }
  get confirmModalLabel(): string {
    const item = this.machine();
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChangesLower');
      case 'toggleActive': return item?.active ? t('users.deactivate') : t('users.activate');
      default: return t('grid.confirm');
    }
  }
  get confirmModalBtnClass(): string {
    const item = this.machine();
    switch (this.pendingAction) {
      case 'toggleActive': return item?.active ? 'btn-danger' : 'btn-success';
      default: return 'btn-primary';
    }
  }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadMachine(id);
    });
  }

  private loadMachine(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.http.get<CatalogItem>(`${this.endpoint}/${id}`).subscribe({
      next: (item) => {
        this.machine.set(item);
        this.form = this.buildForm(item);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  private buildForm(item: CatalogItem | null) {
    return this.fb.nonNullable.group({
      name: [item?.name ?? '', [Validators.required, Validators.minLength(2)]],
    });
  }

  discardChanges(): void {
    const item = this.machine();
    if (!item) return;
    this.form = this.buildForm(item);
  }

  requestSave(): void {
    if (!this.machine() || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('machines.fixRequiredFields'));
      return;
    }
    this.pendingAction = 'save';
    this.confirmModalCmp.open(this.translation.t('machines.saveConfirm'));
  }

  requestToggleActive(): void {
    const item = this.machine();
    if (!item) return;
    this.pendingAction = 'toggleActive';
    const message = item.active
      ? this.translation.t('machines.deactivateConfirm', { name: item.name })
      : this.translation.t('machines.activateConfirm', { name: item.name });
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
    const item = this.machine();
    if (!item || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('machines.fixRequiredFields'));
      return;
    }

    const body: UpdateCatalogRequest = this.form.getRawValue();
    this.saving.set(true);

    this.http.put<CatalogItem>(`${this.endpoint}/${item.id}`, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.machine.set(updated);
        this.form = this.buildForm(updated);
        this.toastService.success(this.translation.t('machines.updateSuccess', { name: updated.name }));
      },
      error: (err) => {
        this.saving.set(false);
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
      },
    });
  }

  private toggleActive(): void {
    const item = this.machine();
    if (!item) return;
    this.togglingActive.set(true);
    this.http.patch<CatalogItem>(`${this.endpoint}/${item.id}/active`, {}).subscribe({
      next: (updated) => {
        this.togglingActive.set(false);
        this.machine.set(updated);
        this.toastService.success(
          updated.active
            ? this.translation.t('machines.activatedSuccess', { name: updated.name })
            : this.translation.t('machines.deactivatedSuccess', { name: updated.name })
        );
      },
      error: () => this.togglingActive.set(false),
    });
  }
}
