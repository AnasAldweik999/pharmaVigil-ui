import { Component, ViewChild, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { DepartmentResponse, ExceptionalHoldingResponse, SupervisorDropdownItem, UpdateDepartmentRequest } from '../../../../core/models/department.models';
import { Page } from '../../../../core/models/user.models';
import { ProductItem } from '../../../../core/models/product.models';
import { CatalogItem } from '../../../../core/models/catalog.models';
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
  selector: 'app-department-detail',
  imports: [ReactiveFormsModule, RouterLink, NgClass, ConfirmModalComponent, MultiSelectComponent, SearchableDropdownComponent, TagInputComponent, TranslatePipe],
  templateUrl: './department-detail.component.html',
})
export class DepartmentDetailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly departmentService = inject(DepartmentService);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;
  private pendingAction: 'save' | 'toggleActive' | null = null;

  readonly loading        = signal(true);
  readonly notFound       = signal(false);
  readonly saving         = signal(false);
  readonly togglingActive = signal(false);

  readonly department = signal<DepartmentResponse | null>(null);

  readonly unitOptions     = signal<string[]>([]);
  readonly unitsLoading    = signal(true);
  readonly unitsError      = signal(false);

  readonly supervisorOptions  = signal<SupervisorDropdownItem[]>([]);
  readonly supervisorsLoading = signal(true);
  readonly supervisorsError   = signal(false);

  readonly products        = signal<ProductItem[]>([]);
  readonly productsLoading = signal(true);
  readonly productsError   = signal(false);

  readonly machines        = signal<CatalogItem[]>([]);
  readonly machinesLoading = signal(true);
  readonly machinesError   = signal(false);

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

  form = this.buildForm(null);

  get confirmModalTitle(): string {
    const dept = this.department();
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChanges');
      case 'toggleActive': return dept?.active ? t('departments.deactivateDepartment') : t('departments.activateDepartment');
      default: return t('grid.confirm');
    }
  }
  get confirmModalLabel(): string {
    const dept = this.department();
    const t = (k: string) => this.translation.t(k);
    switch (this.pendingAction) {
      case 'save': return t('users.saveChangesLower');
      case 'toggleActive': return dept?.active ? t('users.deactivate') : t('users.activate');
      default: return t('grid.confirm');
    }
  }
  get confirmModalBtnClass(): string {
    const dept = this.department();
    switch (this.pendingAction) {
      case 'toggleActive': return dept?.active ? 'btn-danger' : 'btn-success';
      default: return 'btn-primary';
    }
  }

  constructor() {
    this.loadUnits();
    this.loadSupervisors();
    this.loadProducts();
    this.loadMachines();

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadDepartment(id);
    });
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

  // Bulk-fetched once (unfiltered) purely to resolve already-selected supervisor
  // ids to display names/emails for the chips shown when opening an existing
  // department — the picker itself searches live against `supervisorSearchUrl`.
  loadSupervisors(): void {
    this.supervisorsLoading.set(true);
    this.supervisorsError.set(false);
    const params = new HttpParams().set('size', '500').set('sort', 'name,asc');
    this.http.get<Page<SupervisorDropdownItem>>(this.supervisorSearchUrl, { params }).subscribe({
      next: (page) => { this.supervisorOptions.set(page.content); this.supervisorsLoading.set(false); },
      error: () => { this.supervisorsError.set(true); this.supervisorsLoading.set(false); },
    });
  }

  // Bulk-fetched once (unfiltered) purely to resolve already-selected exceptional-
  // holding product ids to names when opening an existing department — the row
  // pickers themselves search live against `productSearchUrl`.
  loadProducts(): void {
    this.productsLoading.set(true);
    this.productsError.set(false);
    const params = new HttpParams().set('size', '500').set('sort', 'name,asc');
    this.http.get<Page<ProductItem>>(this.productSearchUrl, { params }).subscribe({
      next: (page) => { this.products.set(page.content); this.productsLoading.set(false); },
      error: () => { this.productsError.set(true); this.productsLoading.set(false); },
    });
  }

  // Bulk-fetched once (unfiltered) purely to resolve already-selected machine
  // ids to names when opening an existing department — the picker itself
  // searches live against `machineSearchUrl`.
  loadMachines(): void {
    this.machinesLoading.set(true);
    this.machinesError.set(false);
    const params = new HttpParams().set('size', '500').set('sort', 'name,asc');
    this.http.get<Page<CatalogItem>>(this.machineSearchUrl, { params }).subscribe({
      next: (page) => { this.machines.set(page.content); this.machinesLoading.set(false); },
      error: () => { this.machinesError.set(true); this.machinesLoading.set(false); },
    });
  }

  private loadDepartment(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.departmentService.getById(id).subscribe({
      next: (dept) => {
        this.department.set(dept);
        this.form = this.buildForm(dept);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  // ── Form construction ────────────────────────────────────────────────────

  private buildForm(dept: DepartmentResponse | null): FormGroup {
    return this.fb.group({
      name: [dept?.name ?? '', [Validators.required, Validators.maxLength(255)]],
      stages: [[...(dept?.stages ?? [])] as string[]],
      outputs: this.fb.group({
        hasOutputs: [dept?.hasOutputs ?? false],
        units: [[...(dept?.units ?? [])] as string[]],
      }, { validators: outputsValidator }),
      showConsignee: [dept?.showConsignee ?? false],
      terminalDepartment: [dept?.terminalDepartment ?? false],
      machineIds: [[...(dept?.machineIds ?? [])] as string[]],
      supervisorIds: [[...(dept?.supervisorIds ?? [])] as string[]],
      standardHoldingTime: [dept?.standardHoldingTime ?? (null as number | null), [Validators.required, Validators.min(1), Validators.max(1000)]],
      exceptionalHoldings: this.fb.array((dept?.exceptionalHoldings ?? []).map((h) => this.buildHoldingGroup(h))),
    });
  }

  private buildHoldingGroup(h?: ExceptionalHoldingResponse): FormGroup {
    return this.fb.group({
      productId: [h?.productId ?? '', Validators.required],
      holdingTimeDays: [h?.holdingTimeDays ?? (null as number | null), [Validators.required, Validators.min(1), Validators.max(1000)]],
    });
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get nameControl()                { return this.form.get('name')!; }
  get stagesControl()              { return this.form.get('stages')!; }
  get outputsGroup(): FormGroup    { return this.form.get('outputs') as FormGroup; }
  get hasOutputsControl()          { return this.outputsGroup.get('hasOutputs')!; }
  get unitsControl()               { return this.outputsGroup.get('units')!; }
  get showConsigneeControl()       { return this.form.get('showConsignee')!; }
  get terminalDepartmentControl()  { return this.form.get('terminalDepartment')!; }
  get machineIdsControl()          { return this.form.get('machineIds')!; }
  get supervisorIdsControl()       { return this.form.get('supervisorIds')!; }
  get standardHoldingTimeControl() { return this.form.get('standardHoldingTime')!; }
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

  addHolding(): void { this.holdingsArray.push(this.buildHoldingGroup()); this.holdingsArray.markAsDirty(); }
  removeHolding(i: number): void { this.holdingsArray.removeAt(i); this.holdingsArray.markAsDirty(); }

  selectedProductIdsExcept(hi: number): string[] {
    return this.holdingsArray.controls
      .filter((_, i) => i !== hi)
      .map((g) => (g as FormGroup).get('productId')?.value as string)
      .filter((v) => !!v);
  }

  // ── Discard / Save / Delete ──────────────────────────────────────────────

  discardChanges(): void {
    const dept = this.department();
    if (!dept) return;
    this.form = this.buildForm(dept);
  }

  requestSave(): void {
    if (!this.department() || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }
    this.pendingAction = 'save';
    this.confirmModalCmp.open(this.translation.t('departments.saveConfirm'));
  }

  requestToggleActive(): void {
    const dept = this.department();
    if (!dept) return;
    this.pendingAction = 'toggleActive';
    const message = dept.active
      ? this.translation.t('departments.deactivateConfirm', { name: dept.name })
      : this.translation.t('departments.activateConfirm', { name: dept.name });
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
    const dept = this.department();
    if (!dept || this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.invalid) this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }

    const body = this.buildRequest();
    this.saving.set(true);

    this.departmentService.update(dept.id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.department.set(updated);
        this.form = this.buildForm(updated);
        this.toastService.success(this.translation.t('departments.updateSuccess', { name: updated.name }));
      },
      error: (err) => {
        this.saving.set(false);
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
      },
    });
  }

  private toggleActive(): void {
    const dept = this.department();
    if (!dept) return;
    this.togglingActive.set(true);
    this.departmentService.toggleActive(dept.id).subscribe({
      next: (updated) => {
        this.togglingActive.set(false);
        this.department.set(updated);
        this.toastService.success(
          updated.active
            ? this.translation.t('departments.activatedSuccess', { name: updated.name })
            : this.translation.t('departments.deactivatedSuccess', { name: updated.name })
        );
      },
      error: () => this.togglingActive.set(false),
    });
  }

  private buildRequest(): UpdateDepartmentRequest {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exceptionalHoldings: (v.exceptionalHoldings ?? []).map((h: any) => ({
        productId: (h['productId'] as string) ?? '',
        holdingTimeDays: Number(h['holdingTimeDays']),
      })),
    };
  }
}
