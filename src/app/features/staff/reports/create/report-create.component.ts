import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser, NgClass } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { batchNoValidators } from '../../../../core/validators/batch-no.validator';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  CreateWorkReportRequest,
  MachineStatus,
  WorkReportResponse,
} from '../../../../core/models/work-report.models';
import { DepartmentResponse } from '../../../../core/models/department.models';
import { Page } from '../../../../core/models/user.models';
import { SearchableDropdownComponent } from '../../../../shared/searchable-dropdown/searchable-dropdown.component';
import { MultiSelectComponent } from '../../../../shared/multi-select/multi-select.component';
import { getWrapOutputSizeClass, getWrapSizeClass } from '../../../../core/utils/text-size.util';
import { buildDuration, durationTotalMinutes, parseDuration } from '../../../../core/utils/duration.util';

type DepartmentLookupState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

function outputUnitsValidator(ctrl: AbstractControl): ValidationErrors | null {
  const raw = ctrl.value;
  if (raw === null || raw === undefined || raw === '') return null;
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) return { invalidNumber: true };
  if (str.length > 15)    return { maxIntegerDigits: true };
  return null;
}

function stopDurationValidator(ctrl: AbstractControl): ValidationErrors | null {
  const hours = ctrl.get('durationHours')?.value;
  const minutes = ctrl.get('durationMinutes')?.value;
  return durationTotalMinutes(hours, minutes) > 0 ? null : { durationRequired: true };
}

function qualityValidator(ctrl: AbstractControl): ValidationErrors | null {
  const deviation = ctrl.get('deviation')?.value as boolean;
  const deviationDetails = (ctrl.get('deviationDetails')?.value as string | null)?.trim();
  const hold = ctrl.get('hold')?.value as boolean;
  const holdDetails = (ctrl.get('holdDetails')?.value as string | null)?.trim();
  const errors: ValidationErrors = {};
  if (deviation && !deviationDetails) errors['deviationDetailsRequired'] = true;
  if (hold && !holdDetails) errors['holdDetailsRequired'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-report-create',
  imports: [ReactiveFormsModule, RouterLink, NgClass, SearchableDropdownComponent, MultiSelectComponent, DecimalPipe, TranslatePipe],
  templateUrl: './report-create.component.html',
})
export class ReportCreateComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly http         = inject(HttpClient);
  private readonly router       = inject(Router);
  protected readonly base       = environment.apiUrl;
  private readonly platformId   = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);
  readonly translation          = inject(TranslationService);

  @ViewChild('confirmModal') private confirmModalRef!: ElementRef<HTMLElement>;
  private bsConfirmModal: { show(): void; hide(): void } | null = null;

  readonly today          = new Date().toLocaleDateString('en-CA');
  readonly submitting     = signal(false);
  readonly submitted      = signal(false);
  readonly confirmPreview = signal<WorkReportResponse | null>(null);

  readonly getWrapSizeClass = getWrapSizeClass;
  readonly getWrapOutputSizeClass = getWrapOutputSizeClass;
  readonly parseDuration = parseDuration;

  private shiftLabel                                                 = '';
  private readonly machineLabels   = new WeakMap<AbstractControl, string>();
  private readonly stopTypeLabels  = new WeakMap<AbstractControl, string>();
  private readonly productLabels   = new WeakMap<AbstractControl, string>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly departmentSignals      = new WeakMap<AbstractControl, WritableSignal<DepartmentResponse | null>>();
  private readonly departmentStateSignals = new WeakMap<AbstractControl, WritableSignal<DepartmentLookupState>>();

  readonly shiftLabelFn    = (s: any) => s.name as string;
  readonly shiftValueFn    = (s: any) => s.id as string;
  readonly machineLabelFn  = (m: any) => m.name as string;
  readonly machineValueFn  = (m: any) => m.id as string;
  readonly stopTypeLabelFn = (st: any) => st.name as string;
  readonly stopTypeValueFn = (st: any) => st.id as string;
  readonly productLabelFn = (p: any) => p.name as string;
  readonly productValueFn = (p: any) => p.id as string;
  readonly unitLabelFn    = (u: string) => u;
  readonly unitValueFn    = (u: string) => u;
  readonly stageLabelFn   = (s: string) => s;
  readonly stageValueFn   = (s: string) => s;

  readonly durationHourOptions   = Array.from({ length: 24 }, (_, i) => i);
  readonly durationMinuteOptions = Array.from({ length: 60 }, (_, i) => i);

  readonly statusList: MachineStatus[] = ['RUNNING', 'STOPPED', 'MAINTENANCE', 'READY'];
  readonly statusConfig: Record<MachineStatus, { borderClass: string; bgClass: string }> = {
    RUNNING:     { borderClass: 'border-success', bgClass: 'bg-success' },
    STOPPED:     { borderClass: 'border-danger',  bgClass: 'bg-danger'  },
    MAINTENANCE: { borderClass: 'border-warning', bgClass: 'bg-warning' },
    READY:       { borderClass: 'border-primary', bgClass: 'bg-primary' },
  };

  form = this.fb.group({
    reportDate: [this.today, Validators.required],
    shiftId:    ['', Validators.required],
    machines:   this.fb.array([this.buildMachineGroup()]),
  });

  private getConfirmModal(): { show(): void; hide(): void } | null {
    if (!isPlatformBrowser(this.platformId) || !this.confirmModalRef?.nativeElement) return null;
    if (!this.bsConfirmModal) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BootstrapModal = (window as any).bootstrap?.Modal;
      if (!BootstrapModal) return null;
      this.bsConfirmModal = new BootstrapModal(this.confirmModalRef.nativeElement) as { show(): void; hide(): void };
    }
    return this.bsConfirmModal;
  }

  // ── FormArray accessors ───────────────────────────────────────────────────

  get machinesArray(): FormArray { return this.form.get('machines') as FormArray; }

  getMachineGroup(mi: number): FormGroup {
    return this.machinesArray.at(mi) as FormGroup;
  }

  getProductsArray(mi: number): FormArray {
    return this.getMachineGroup(mi).get('products') as FormArray;
  }

  getProductGroup(mi: number, pi: number): FormGroup {
    return this.getProductsArray(mi).at(pi) as FormGroup;
  }

  getStopsArray(mi: number, pi: number): FormArray {
    return this.getProductGroup(mi, pi).get('stops') as FormArray;
  }

  getQualityGroup(mi: number, pi: number): FormGroup {
    return this.getProductGroup(mi, pi).get('quality') as FormGroup;
  }

  getDepartment(mi: number): DepartmentResponse | null {
    return this.departmentSignals.get(this.getMachineGroup(mi))?.() ?? null;
  }

  getDepartmentState(mi: number): DepartmentLookupState {
    return this.departmentStateSignals.get(this.getMachineGroup(mi))?.() ?? 'idle';
  }

  // ── Add / Remove ──────────────────────────────────────────────────────────

  addMachine(): void { this.machinesArray.push(this.buildMachineGroup()); }

  removeMachine(mi: number): void {
    if (this.machinesArray.length > 1) this.machinesArray.removeAt(mi);
  }

  setStatus(mi: number, status: MachineStatus): void {
    this.getMachineGroup(mi).get('status')!.setValue(status);
  }

  addProduct(mi: number): void {
    const group = this.buildProductGroup();
    const department = this.departmentSignals.get(this.getMachineGroup(mi))?.() ?? null;
    this.applyDepartmentRulesToProduct(group, department);
    this.getProductsArray(mi).push(group);
  }

  removeProduct(mi: number, pi: number): void {
    if (this.getProductsArray(mi).length > 1) this.getProductsArray(mi).removeAt(pi);
  }

  addStop(mi: number, pi: number): void {
    this.getStopsArray(mi, pi).push(this.buildStopGroup());
  }

  removeStop(mi: number, pi: number, si: number): void {
    this.getStopsArray(mi, pi).removeAt(si);
  }

  // ── Label tracking for confirmation preview ───────────────────────────────

  onShiftLabelChange(label: string): void { this.shiftLabel = label; }
  onMachineLabelChange(mi: number, label: string): void {
    this.machineLabels.set(this.machinesArray.at(mi), label);
  }
  onStopTypeLabelChange(mi: number, pi: number, si: number, label: string): void {
    this.stopTypeLabels.set(this.getStopsArray(mi, pi).at(si), label);
  }
  onProductLabelChange(mi: number, pi: number, label: string): void {
    this.productLabels.set(this.getProductGroup(mi, pi), label);
  }
  onStagesChange(mi: number, pi: number, values: string[]): void {
    const ctrl = this.getProductGroup(mi, pi).get('selectedStages')!;
    ctrl.setValue(values);
    ctrl.markAsTouched();
    ctrl.markAsDirty();
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translation.t('reportCreate.fixRequiredFields'));
      return;
    }
    this.confirmPreview.set(this.buildPreview());
    this.getConfirmModal()?.show();
  }

  confirmSubmit(): void {
    this.getConfirmModal()?.hide();
    this.submitting.set(true);
    this.http.post(`${this.base}/api/staff/work-reports`, this.buildRequest()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/staff/reports']);
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }

  // ── Styling helpers ───────────────────────────────────────────────────────

  statusCardClass(currentStatus: string, cardStatus: MachineStatus): string {
    const cfg = this.statusConfig[cardStatus];
    return currentStatus === cardStatus
      ? `border border-2 ${cfg.borderClass} ${cfg.bgClass} bg-opacity-10`
      : 'border border-2 border-light-subtle bg-white opacity-50';
  }

  isInvalid(ctrl: AbstractControl | null): boolean {
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitted());
  }

  selectedStageNames(stages: Record<string, boolean> | null | undefined): string[] {
    if (!stages) return [];
    return Object.entries(stages).filter(([, v]) => v).map(([k]) => k);
  }

  isStopDurationInvalid(mi: number, pi: number, si: number): boolean {
    const stop = this.getStopsArray(mi, pi).at(si);
    const touched = stop.touched || this.submitted();
    const durationZero = touched && stop.hasError('durationRequired');
    return durationZero || this.isInvalid(stop.get('durationHours')) || this.isInvalid(stop.get('durationMinutes'));
  }

  stopDurationErrorText(mi: number, pi: number, si: number): string {
    const stop = this.getStopsArray(mi, pi).at(si);
    if (stop.get('durationHours')?.invalid) return this.translation.t('reportCreate.hoursRange');
    if (stop.get('durationMinutes')?.invalid) return this.translation.t('reportCreate.minutesRange');
    return this.translation.t('reportCreate.min1Minute');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildMachineGroup(): FormGroup {
    const group = this.fb.group({
      machineId:    ['', Validators.required],
      departmentId: [''],
      status:       ['RUNNING', Validators.required],
      products:     this.fb.array([this.buildProductGroup()]),
    }, { validators: (ctrl: AbstractControl) => this.machineDepartmentValidator(ctrl) });

    const departmentSig = signal<DepartmentResponse | null>(null);
    const stateSig = signal<DepartmentLookupState>('idle');
    this.departmentSignals.set(group, departmentSig);
    this.departmentStateSignals.set(group, stateSig);

    group.get('machineId')!.valueChanges.pipe(
      distinctUntilChanged(),
      switchMap((machineId) => {
        departmentSig.set(null);
        group.get('departmentId')!.setValue('', { emitEvent: false });
        if (!machineId) { stateSig.set('idle'); return of(null); }
        stateSig.set('loading');
        const params = new HttpParams().set('machineId', machineId);
        return this.http.get<Page<DepartmentResponse>>(`${this.base}/api/staff/reference/departments`, { params }).pipe(
          map((page) => ({ ok: true as const, dept: page.content[0] ?? null })),
          catchError(() => of({ ok: false as const, dept: null })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((result) => {
      if (result === null) { group.updateValueAndValidity(); return; }
      if (!result.ok) {
        stateSig.set('error');
      } else if (result.dept) {
        departmentSig.set(result.dept);
        stateSig.set('found');
        group.get('departmentId')!.setValue(result.dept.id);
      } else {
        stateSig.set('not-found');
      }
      const products = group.get('products') as FormArray;
      products.controls.forEach((p) => this.applyDepartmentRulesToProduct(p as FormGroup, departmentSig()));
      group.updateValueAndValidity();
    });

    return group;
  }

  private machineDepartmentValidator(ctrl: AbstractControl): ValidationErrors | null {
    if (!ctrl.get('machineId')?.value) return null;
    const state = this.departmentStateSignals.get(ctrl)?.() ?? 'idle';
    if (state === 'not-found' || state === 'error') return { machineNoDepartment: true };
    if (state !== 'found') return { departmentPending: true };
    return null;
  }

  private buildProductGroup(): FormGroup {
    return this.fb.group({
      productId:      ['', Validators.required],
      batchNo:        ['', batchNoValidators],
      output:         [''],
      unit:           [''],
      consignee:      ['', Validators.maxLength(255)],
      selectedStages: [[] as string[]],
      stops:          this.fb.array([]),
      quality:        this.buildQualityGroup(),
    });
  }

  // Resets every department-scoped field before re-applying validators, so a value
  // typed under one department (e.g. output/unit for a department that has outputs)
  // never survives a machine/department change and gets silently submitted under a
  // department it no longer applies to (e.g. one with hasOutputs=false, or a unit
  // that isn't in the new department's allowed list).
  private applyDepartmentRulesToProduct(product: FormGroup, department: DepartmentResponse | null): void {
    const output    = product.get('output')!;
    const unit      = product.get('unit')!;
    const consignee = product.get('consignee')!;
    const stages    = product.get('selectedStages')!;

    output.reset('', { emitEvent: false });
    unit.reset('', { emitEvent: false });
    consignee.reset('', { emitEvent: false });
    stages.reset([], { emitEvent: false });

    if (department?.hasOutputs) {
      output.setValidators([Validators.required, outputUnitsValidator]);
      unit.setValidators([Validators.required]);
    } else {
      output.setValidators([]);
      unit.setValidators([]);
    }
    stages.setValidators([]);

    output.updateValueAndValidity({ emitEvent: false });
    unit.updateValueAndValidity({ emitEvent: false });
    consignee.updateValueAndValidity({ emitEvent: false });
    stages.updateValueAndValidity({ emitEvent: false });
  }

  private buildStagesMap(mi: number, selected: string[]): Record<string, boolean> {
    const department = this.departmentSignals.get(this.getMachineGroup(mi))?.() ?? null;
    const allStages = department?.stages ?? [];
    const selectedSet = new Set(selected ?? []);
    return Object.fromEntries(allStages.map((s) => [s, selectedSet.has(s)]));
  }

  private buildQualityGroup(): FormGroup {
    return this.fb.group({
      deviation:        [false],
      deviationDetails: [''],
      hold:             [false],
      holdDetails:      [''],
    }, { validators: qualityValidator });
  }

  private buildStopGroup(): FormGroup {
    return this.fb.group({
      stopTypeId:      ['', Validators.required],
      durationHours:   [0, [Validators.min(0), Validators.max(23)]],
      durationMinutes: [0, [Validators.min(0), Validators.max(59)]],
      note:            ['', Validators.maxLength(255)],
    }, { validators: stopDurationValidator });
  }

  private buildPreview(): WorkReportResponse {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = this.form.getRawValue() as any;
    return {
      id: '', staffId: '', staffName: '', staffUsername: '', staffEmail: '',
      shiftId: v.shiftId as string,
      shiftName:  this.shiftLabel,
      reportDate: v.reportDate as string,
      createdAt: '', updatedAt: '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      machines: (v.machines as any[]).map((m, mi) => {
        const machineGroup = this.machinesArray.at(mi);
        const department = this.departmentSignals.get(machineGroup)?.() ?? null;
        return {
        id: '', machineId: m.machineId as string,
        machineName: this.machineLabels.get(machineGroup) ?? this.translation.t('reportCreate.machineNum', { n: '' + (mi + 1) }),
        departmentId: m.departmentId as string,
        departmentName: department?.name ?? '',
        status: m.status as MachineStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products: (m.products as any[]).map((p, pi) => {
          const productGroup = this.getProductGroup(mi, pi);
          return {
          id: '',
          productId: p.productId as string,
          productName: this.productLabels.get(productGroup) ?? '',
          batchNo:     p.batchNo as string,
          output: p.output ? Number(p.output) : 0,
          unit: (p.unit as string) || null,
          consignee: (p.consignee as string) || null,
          stages: this.buildStagesMap(mi, p.selectedStages as string[]),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stops: (p.stops as any[]).map((s, si) => ({
            id: '', stopTypeId: s.stopTypeId as string,
            stopTypeName: this.stopTypeLabels.get(this.getStopsArray(mi, pi).at(si)) ?? '—',
            duration: buildDuration(s.durationHours, s.durationMinutes),
            note: (s.note as string) || null,
          })),
          quality: {
            deviation:        !!p.quality.deviation,
            deviationDetails: p.quality.deviation ? (p.quality.deviationDetails as string || null) : null,
            hold:             !!p.quality.hold,
            holdDetails:      p.quality.hold ? (p.quality.holdDetails as string || null) : null,
          },
        };
        }),
      };
      }),
    };
  }

  private buildRequest(): CreateWorkReportRequest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = this.form.getRawValue() as any;
    return {
      reportDate: v.reportDate as string,
      shiftId:    v.shiftId as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      machines: v.machines.map((m: any, mi: number) => ({
        machineId: m.machineId as string,
        departmentId: m.departmentId as string,
        status:    m.status as MachineStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products: m.products.map((p: any) => ({
          productId: p.productId as string,
          batchNo:     p.batchNo as string,
          output: p.output ? Number(p.output) : 0,
          unit: (p.unit as string) || null,
          consignee: (p.consignee as string) || null,
          stages: this.buildStagesMap(mi, p.selectedStages as string[]),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stops: p.stops.map((s: any) => ({
            stopTypeId: s.stopTypeId as string,
            duration:   buildDuration(s.durationHours, s.durationMinutes),
            note:       (s.note as string) || null,
          })),
          quality: {
            deviation:        !!p.quality.deviation,
            deviationDetails: p.quality.deviation ? (p.quality.deviationDetails as string) : null,
            hold:             !!p.quality.hold,
            holdDetails:      p.quality.hold ? (p.quality.holdDetails as string) : null,
          },
        })),
      })),
    };
  }

}
