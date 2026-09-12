import { Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, FormControlStatus, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RoleOption, UserRole } from '../../../../core/models/role.models';
import { UpdateUserRequest, UserResponse } from '../../../../core/models/user.models';
import { UserService } from '../../../../core/services/user.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { usernameValidators } from '../../../../core/validators/username.validator';
import { asyncFieldAvailabilityValidator } from '../../../../core/validators/async-field-availability.validator';
import { extractErrorMessage, extractFieldViolations } from '../../../../core/utils/api-error.util';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-user-detail',
  imports: [ReactiveFormsModule, RouterLink, ConfirmModalComponent, NgClass, TranslatePipe],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private statusSubs: Subscription[] = [];

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;
  private pendingAction: 'save' | 'toggleActive' | null = null;

  readonly availableRoles   = signal<RoleOption[]>([]);
  readonly visibleRoles = computed(() => {
    const user = this.user();
    if (!user) return [];
    return this.availableRoles().filter((r) => r.accountType === user.accountType);
  });

  readonly loading        = signal(true);
  readonly notFound       = signal(false);
  readonly saving         = signal(false);
  readonly togglingActive = signal(false);
  readonly fieldErrors    = signal<Record<string, string>>({});

  readonly user = signal<UserResponse | null>(null);

  readonly statusBadgeClass = computed(() => {
    const status = this.user()?.status;
    return status === 'ACTIVE' ? 'pv-chip--success' : status === 'INACTIVE' ? 'pv-chip--danger' : 'pv-chip--warning';
  });
  readonly statusLabel = computed(() => {
    const status = this.user()?.status;
    return status === 'ACTIVE' ? this.translation.t('users.active') : status === 'INACTIVE' ? this.translation.t('users.inactive') : this.translation.t('users.pendingVerification');
  });
  readonly accountTypeTagClass = computed(() =>
    this.user()?.accountType === 'SUPERVISOR' ? 'pv-tag--supervisor' : 'pv-tag--staff'
  );
  readonly canToggleActive = computed(() => this.user()?.status !== 'PENDING_EMAIL_VERIFICATION');

  get confirmModalTitle(): string {
    const status = this.user()?.status;
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChanges');
      case 'toggleActive': return status === 'ACTIVE' ? t('users.deactivateUser') : t('users.activateUser');
      default: return t('grid.confirm');
    }
  }
  get confirmModalLabel(): string {
    const status = this.user()?.status;
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChangesLower');
      case 'toggleActive': return status === 'ACTIVE' ? t('users.deactivate') : t('users.activate');
      default: return t('grid.confirm');
    }
  }
  get confirmModalBtnClass(): string {
    const status = this.user()?.status;
    switch (this.pendingAction) {
      case 'toggleActive': return status === 'ACTIVE' ? 'btn-danger' : 'btn-success';
      default: return 'btn-primary';
    }
  }

  form = this.buildForm(null, null);
  readonly usernameStatus = signal<FormControlStatus>(this.form.controls.username.status);
  readonly emailStatus    = signal<FormControlStatus>(this.form.controls.email.status);

  constructor() {
    this.wireStatusSignals();
    this.destroyRef.onDestroy(() => this.statusSubs.forEach((s) => s.unsubscribe()));

    this.userService.getRoles().subscribe({ next: (roles) => this.availableRoles.set(roles) });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadUser(id);
    });
  }

  // toSignal() requires an active injection context, which only exists synchronously
  // during construction — not inside an async HTTP callback. Since the form (and its
  // controls) are rebuilt fresh on every id load, status is tracked with plain signals
  // fed by manually-managed subscriptions instead, which are safe to (re)wire from anywhere.
  private wireStatusSignals(): void {
    this.statusSubs.forEach((s) => s.unsubscribe());
    this.usernameStatus.set(this.form.controls.username.status);
    this.emailStatus.set(this.form.controls.email.status);
    this.statusSubs = [
      this.form.controls.username.statusChanges.subscribe((s) => this.usernameStatus.set(s)),
      this.form.controls.email.statusChanges.subscribe((s) => this.emailStatus.set(s)),
    ];
  }

  private loadUser(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.userService.getById(id).subscribe({
      next: (user) => {
        this.user.set(user);
        this.form = this.buildForm(user, id);
        this.wireStatusSignals();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  private buildForm(user: UserResponse | null, id: string | null) {
    return this.fb.nonNullable.group({
      name: [user?.name ?? '', [Validators.required, Validators.minLength(3)]],
      email: [
        user?.email ?? '',
        [Validators.required, Validators.email],
        [asyncFieldAvailabilityValidator((v) => this.userService.checkEmail(v), id ?? undefined)],
      ],
      username: [
        user?.username ?? '',
        usernameValidators,
        [asyncFieldAvailabilityValidator((v) => this.userService.checkUsername(v), id ?? undefined)],
      ],
      roles: this.fb.nonNullable.control<UserRole[]>([...(user?.roles ?? [])]),
    });
  }

  isRoleSelected(role: RoleOption): boolean {
    return (this.form.controls.roles.value ?? []).includes(role.key);
  }

  toggleRole(role: RoleOption): void {
    const current = this.form.controls.roles.value ?? [];
    const next = current.includes(role.key) ? current.filter((r: UserRole) => r !== role.key) : [...current, role.key];
    this.form.controls.roles.setValue(next);
    this.form.controls.roles.markAsTouched();
    this.form.controls.roles.markAsDirty();
  }

  selectAllRoles(): void {
    this.form.controls.roles.setValue(this.visibleRoles().map((r) => r.key));
    this.form.controls.roles.markAsTouched();
    this.form.controls.roles.markAsDirty();
  }

  clearRoles(): void {
    this.form.controls.roles.setValue([]);
    this.form.controls.roles.markAsTouched();
    this.form.controls.roles.markAsDirty();
  }

  discardChanges(): void {
    const user = this.user();
    if (!user) return;
    this.form.reset({
      name: user.name,
      email: user.email,
      username: user.username,
      roles: [...user.roles],
    });
    this.fieldErrors.set({});
  }

  requestSave(): void {
    if (!this.user() || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }
    this.pendingAction = 'save';
    this.confirmModalCmp.open(this.translation.t('users.saveConfirm'));
  }

  requestToggleActive(): void {
    const user = this.user();
    if (!user) return;
    this.pendingAction = 'toggleActive';
    const message = user.status === 'ACTIVE'
      ? this.translation.t('users.deactivateConfirm', { name: user.name })
      : this.translation.t('users.activateConfirm', { name: user.name });
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
    const user = this.user();
    if (!user || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }

    const { name, email, username, roles } = this.form.getRawValue();
    const body: UpdateUserRequest = { name, email, username, roles };

    this.saving.set(true);
    this.fieldErrors.set({});

    this.userService.update(user.id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.user.set(updated);
        this.form.reset({
          name: updated.name,
          email: updated.email,
          username: updated.username,
          roles: [...updated.roles],
        });
        this.toastService.success(this.translation.t('users.updateSuccess', { name: updated.name }));
      },
      error: (err) => {
        this.saving.set(false);
        const fields = extractFieldViolations(err, (code) => this.translation.errorMessage(code));
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'userUpdateFailed', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
        if (Object.keys(fields).length > 0) {
          this.fieldErrors.set(fields);
        }
      },
    });
  }

  private toggleActive(): void {
    const user = this.user();
    if (!user) return;
    this.togglingActive.set(true);
    this.userService.toggleActive(user.id).subscribe({
      next: (updated) => {
        this.togglingActive.set(false);
        this.user.set(updated);
        this.toastService.success(
          updated.status === 'ACTIVE'
            ? this.translation.t('users.activatedSuccess', { name: updated.name })
            : this.translation.t('users.deactivatedSuccess', { name: updated.name })
        );
      },
      error: () => this.togglingActive.set(false),
    });
  }

  get nameControl()     { return this.form.controls.name; }
  get emailControl()    { return this.form.controls.email; }
  get usernameControl() { return this.form.controls.username; }
  get rolesControl()    { return this.form.controls.roles; }
}
