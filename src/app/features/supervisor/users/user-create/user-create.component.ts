import { Component, ViewChild, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AccountType, RoleOption, UserRole } from '../../../../core/models/role.models';
import { CreateUserRequest, UserResponse } from '../../../../core/models/user.models';
import { UserService } from '../../../../core/services/user.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { usernameValidators } from '../../../../core/validators/username.validator';
import { asyncFieldAvailabilityValidator } from '../../../../core/validators/async-field-availability.validator';
import { extractErrorMessage, extractFieldViolations } from '../../../../core/utils/api-error.util';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-user-create',
  imports: [ReactiveFormsModule, RouterLink, ConfirmModalComponent, TranslatePipe],
  templateUrl: './user-create.component.html',
})
export class UserCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;

  readonly availableRoles   = signal<RoleOption[]>([]);
  readonly rolesLoading     = signal(false);
  readonly selectedAccountType = signal<AccountType>('STAFF');
  readonly visibleRoles = computed(() =>
    this.availableRoles().filter((r) => r.accountType === this.selectedAccountType())
  );

  readonly submitting   = signal(false);
  readonly fieldErrors  = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    accountType: this.fb.nonNullable.control<AccountType>('STAFF', Validators.required),
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email], [asyncFieldAvailabilityValidator((v) => this.userService.checkEmail(v))]],
    username: ['', usernameValidators, [asyncFieldAvailabilityValidator((v) => this.userService.checkUsername(v))]],
    roles: this.fb.nonNullable.control<UserRole[]>([]),
  });

  readonly usernameStatus = toSignal(this.form.controls.username.statusChanges, {
    initialValue: this.form.controls.username.status,
  });
  readonly emailStatus = toSignal(this.form.controls.email.statusChanges, {
    initialValue: this.form.controls.email.status,
  });

  ngOnInit(): void {
    this.loadRoles();
  }

  private loadRoles(): void {
    this.rolesLoading.set(true);
    this.userService.getRoles().subscribe({
      next: (roles) => {
        this.availableRoles.set(roles);
        this.rolesLoading.set(false);
      },
      error: () => this.rolesLoading.set(false),
    });
  }

  isRoleSelected(role: RoleOption): boolean {
    return (this.form.controls.roles.value ?? []).includes(role.key);
  }

  toggleRole(role: RoleOption): void {
    const current = this.form.controls.roles.value ?? [];
    const next = current.includes(role.key) ? current.filter((r) => r !== role.key) : [...current, role.key];
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

  onAccountTypeChange(type: AccountType): void {
    this.selectedAccountType.set(type);
    const allowed = this.visibleRoles().map((r) => r.key);
    this.form.controls.roles.setValue((this.form.controls.roles.value ?? []).filter((r) => allowed.includes(r)));
  }

  requestSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }
    const { accountType, name } = this.form.getRawValue();
    const label = accountType === 'SUPERVISOR' ? this.translation.t('users.supervisor') : this.translation.t('users.staff');
    this.confirmModalCmp.open(this.translation.t('users.createConfirm', { label, name }));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }

    const { accountType, name, email, username, roles } = this.form.getRawValue();
    const body: CreateUserRequest = { name, email, username, roles };

    this.submitting.set(true);
    this.fieldErrors.set({});

    this.userService.create(accountType, body).subscribe({
      next: (newUser: UserResponse) => {
        this.submitting.set(false);
        const label = accountType === 'SUPERVISOR' ? this.translation.t('users.supervisor') : this.translation.t('users.staff');
        this.toastService.success(this.translation.t('users.createSuccess', { label, email: newUser.email }));
        this.router.navigate(['/supervisor/users']);
      },
      error: (err) => {
        this.submitting.set(false);
        const fields = extractFieldViolations(err, (code) => this.translation.errorMessage(code));
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'userCreateFailed', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
        if (Object.keys(fields).length > 0) {
          this.fieldErrors.set(fields);
        }
      },
    });
  }

  get nameControl()     { return this.form.controls.name; }
  get emailControl()    { return this.form.controls.email; }
  get usernameControl() { return this.form.controls.username; }
  get rolesControl()    { return this.form.controls.roles; }
}
