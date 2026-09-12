import { Component, ViewChild, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { CreateDepartmentRequest, SupervisorDropdownItem } from '../../../../core/models/department.models';
import { DepartmentService } from '../../../../core/services/department.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';
import { MultiSelectComponent } from '../../../../shared/multi-select/multi-select.component';
import { SearchableDropdownComponent } from '../../../../shared/searchable-dropdown/searchable-dropdown.component';
import { TagInputComponent } from '../../../../shared/tag-input/tag-input.component';
import { extractErrorMessage } from '../../../../core/utils/api-error.util';

function outputsValidator(ctrl: AbstractControl): ValidationErrors | null {
  const hasOutputs = ctrl.get('hasOutputs')?.value as boolean;
  const units = (ctrl.get('units')?.value as string[]) ?? [];
  return hasOutputs && units.length === 0 ? { unitsRequired: true } : null;
}

@Component({
  selector: 'app-department-create',
  imports: [ReactiveFormsModule, RouterLink, ConfirmModalComponent, MultiSelectComponent, SearchableDropdownComponent, TagInputComponent, TranslatePipe],
  templateUrl: './department-create.component.html',
})
export class DepartmentCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly apiUrl = environment.apiUrl;
  private readonly departmentService = inject(DepartmentService);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;

  readonly submitting  = signal(false);

  readonly unitOptions    = signal<string[]>([]);
  readonly unitsLoading   = signal(true);
  readonly unitsError     = signal(false);

  readonly supervisorSearchUrl = `${this.apiUrl}/api/supervisor/supervisor-users`;
  readonly productSearchUrl    = `${this.apiUrl}/api/supervisor/products`;
  readonly machineSearchUrl    = `${this.apiUrl}/api/supervisor/machines`;

  readonly unitLabelFn = (u: string) => {
    const key = `departments.unit.${u.toLowerCase()}`;
    const translated = this.translation.t(key);
    return translated !== key ? translated : u;
  };
  readonly unitValueFn = (u: string) => u;
  readonly supervisorLabelFn = (u: SupervisorDropdownItem) => u.name;
  readonly supervisorValueFn = (u: SupervisorDropdownItem) => u.id;
  readonly supervisorSecondaryLabelFn = (u: SupervisorDropdownItem) => u.username || u.email;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    stages: [[] as string[]],
    outputs: this.fb.group({
      hasOutputs: [false],
      units: [[] as string[]],
    }, { validators: outputsValidator }),
    showConsignee: [false],
    terminalDepartment: [false],
    machineIds: [[] as string[]],
    supervisorIds: [[] as string[]],
    standardHoldingTime: [null as number | null, [Validators.required, Validators.min(1), Validators.max(1000)]],
    exceptionalHoldings: this.fb.array([] as FormGroup[]),
  });

  constructor() {
    this.loadUnits();
  }

  // ── Lookups ────────────────────────────────────────────────────────────────

  loadUnits(): void {
    this.unitsLoading.set(true);
    this.unitsError.set(false);
    this.departmentService.getAllowedUnits().subscribe({
      next: (units) => { this.unitOptions.set(units); this.unitsLoading.set(false); },
      error: () => { this.unitsError.set(true); this.unitsLoading.set(false); },
    });
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get nameControl()                { return this.form.controls.name; }
  get stagesControl()              { return this.form.controls.stages; }
  get outputsGroup(): FormGroup    { return this.form.get('outputs') as FormGroup; }
  get hasOutputsControl()          { return this.outputsGroup.get('hasOutputs')!; }
  get unitsControl()               { return this.outputsGroup.get('units')!; }
  get showConsigneeControl()       { return this.form.controls.showConsignee; }
  get terminalDepartmentControl()  { return this.form.controls.terminalDepartment; }
  get machineIdsControl()          { return this.form.controls.machineIds; }
  get supervisorIdsControl()       { return this.form.controls.supervisorIds; }
  get standardHoldingTimeControl() { return this.form.controls.standardHoldingTime; }
  get holdingsArray(): FormArray   { return this.form.get('exceptionalHoldings') as FormArray; }

  // ── Holding time input clamping ──────────────────────────────────────────

  clampToMax(event: Event, control: AbstractControl, max: number): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!isNaN(value) && value > max) {
      control.setValue(max);
    }
  }

  // ── Units / Machines / Supervisors ────────────────────────────────────────

  onUnitsChange(values: string[]): void {
    this.unitsControl.setValue(values);
    this.unitsControl.markAsTouched();
    this.unitsControl.markAsDirty();
  }

  onMachinesChange(values: string[]): void {
    this.machineIdsControl.setValue(values);
    this.machineIdsControl.markAsTouched();
    this.machineIdsControl.markAsDirty();
  }

  onSupervisorsChange(values: string[]): void {
    this.supervisorIdsControl.setValue(values);
    this.supervisorIdsControl.markAsTouched();
    this.supervisorIdsControl.markAsDirty();
  }

  // ── Exceptional holdings ──────────────────────────────────────────────────

  addHolding(): void { this.holdingsArray.push(this.buildHoldingGroup()); }
  removeHolding(i: number): void { this.holdingsArray.removeAt(i); }

  selectedProductIdsExcept(hi: number): string[] {
    return this.holdingsArray.controls
      .filter((_, i) => i !== hi)
      .map((g) => (g as FormGroup).get('productId')?.value as string)
      .filter((v) => !!v);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  requestSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }
    const { name } = this.form.getRawValue();
    this.confirmModalCmp.open(this.translation.t('departments.createConfirm', { name: name ?? '' }));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }

    const body = this.buildRequest();
    this.submitting.set(true);

    this.departmentService.create(body).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.toastService.success(this.translation.t('departments.createdSuccess', { name: created.name }));
        this.router.navigate(['/supervisor/departments']);
      },
      error: (err) => {
        this.submitting.set(false);
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
      },
    });
  }

  private buildRequest(): CreateDepartmentRequest {
    const v = this.form.getRawValue();
    const hasOutputs = !!v.outputs?.hasOutputs;
    return {
      name: v.name ?? '',
      stages: v.stages ?? [],
      hasOutputs,
      units: hasOutputs ? (v.outputs?.units ?? []) : [],
      showConsignee: !!v.showConsignee,
      terminalDepartment: !!v.terminalDepartment,
      machineIds: v.machineIds ?? [],
      supervisorIds: v.supervisorIds ?? [],
      standardHoldingTime: Number(v.standardHoldingTime),
      exceptionalHoldings: (v.exceptionalHoldings ?? []).map((h) => ({
        productId: (h['productId'] as string) ?? '',
        holdingTimeDays: Number(h['holdingTimeDays']),
      })),
    };
  }

  private buildHoldingGroup(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      holdingTimeDays: [null as number | null, [Validators.required, Validators.min(1), Validators.max(1000)]],
    });
  }
}
