import { Component, ElementRef, PLATFORM_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { BatchDetailResponse, CreateBatchLogEntryRequest, ReferenceDepartmentItem, RejectBatchRequest } from '../../../../core/models/batch.models';
import { Page } from '../../../../core/models/user.models';
import { BatchService } from '../../../../core/services/batch.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SearchableDropdownComponent } from '../../../../shared/searchable-dropdown/searchable-dropdown.component';
import { BatchAuditFooterComponent } from '../../../../shared/batch-audit-footer/batch-audit-footer.component';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';
import { extractErrorMessage } from '../../../../core/utils/api-error.util';
import { batchStatusChipClass, batchStatusLabelKey } from '../../../../core/utils/batch-status.util';
import { batchNoValidators } from '../../../../core/validators/batch-no.validator';

// Matches the native <input type="datetime-local"> value format (no seconds,
// no timezone) — the backend's combined `lineClearanceAt`/`firstLoggedAt`
// fields are plain `LocalDateTime`s, so this string passes straight through.
function nowDateTimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type LookupState = 'idle' | 'loading' | 'new' | 'existing' | 'locked' | 'error';
type EntryMode = 'checkin' | 'complete';
type DepartmentLookupState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

@Component({
  selector: 'app-batch-log-entry',
  imports: [ReactiveFormsModule, RouterLink, NgClass, SearchableDropdownComponent, BatchAuditFooterComponent, ConfirmModalComponent, TranslatePipe],
  templateUrl: './batch-log-entry.component.html',
})
export class BatchLogEntryComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  @ViewChild('rejectModalRef') private rejectModalRef!: ElementRef<HTMLElement>;
  private rejectBsModal: { show(): void; hide(): void } | null = null;

  @ViewChild('confirmSubmitModal') private confirmSubmitModalCmp!: ConfirmModalComponent;
  readonly selectedMachineLabel = signal('');
  readonly statusChipClass = batchStatusChipClass;
  readonly statusLabelKey = batchStatusLabelKey;

  readonly productSearchUrl = `${this.apiUrl}/api/staff/reference/products`;
  readonly machineSearchUrl = `${this.apiUrl}/api/staff/reference/machines`;
  private readonly departmentLookupUrl = `${this.apiUrl}/api/staff/reference/departments`;

  readonly batchNoControl = this.fb.control('', batchNoValidators);
  readonly lookupState = signal<LookupState>('idle');
  readonly existingBatch = signal<BatchDetailResponse | null>(null);
  readonly submitting = signal(false);
  readonly rejecting = signal(false);
  readonly rejectLineClearanceError = signal<string | null>(null);

  readonly derivedDepartment = signal<ReferenceDepartmentItem | null>(null);
  readonly derivedDepartmentState = signal<DepartmentLookupState>('idle');

  readonly form = this.fb.group({
    productId: ['', Validators.required],
    machineId: [''],
    departmentId: [''],
    mode: ['checkin' as EntryMode],
    lineClearanceAt: [nowDateTimeLocal(), Validators.required],
  }, { validators: [
    this.locationRequiredValidator.bind(this),
    this.duplicateMachineValidator.bind(this),
    this.departmentAlreadyVisitedValidator.bind(this),
    this.notAfterLastLogValidator.bind(this),
    this.notInFutureValidator.bind(this),
  ] });

  readonly rejectForm = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(255)]],
  });

  // The product picker runs in pure remote-search mode (no bulk-fetched
  // options list), so once a batch is found its product id has nothing to
  // resolve a display name against — feed the single known name/id pair back
  // in as `[options]` purely so the picker can show it instead of the raw id.
  readonly productOptions = computed(() => {
    const batch = this.existingBatch();
    return batch ? [{ id: batch.productId, name: batch.productName }] : [];
  });

  readonly isCheckedIn = computed(() => {
    const batch = this.existingBatch();
    return batch !== null && batch.currentMachineId !== null;
  });

  // The batch's currentDepartmentId always matches the last entry's own
  // department right up until a COMPLETED/REJECTED lock, so the last entry's
  // own `terminalDepartment` flag is a reliable proxy — no extra lookup needed.
  readonly isCurrentDepartmentTerminal = computed(() => {
    const batch = this.existingBatch();
    if (!batch || batch.entries.length === 0) return false;
    return batch.entries[batch.entries.length - 1].terminalDepartment;
  });

  // Matches the backend (BatchCompletableValidator): completion only cares
  // that the current department is terminal, whether or not the batch is
  // still checked in to a machine there.
  readonly canComplete = computed(() => this.existingBatch() !== null && this.isCurrentDepartmentTerminal());

  private get rejectModal(): { show(): void; hide(): void } | null {
    if (!isPlatformBrowser(this.platformId) || !this.rejectModalRef?.nativeElement) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BootstrapModal = (window as any).bootstrap?.Modal;
    if (!BootstrapModal) return null;
    if (!this.rejectBsModal) {
      this.rejectBsModal = new BootstrapModal(this.rejectModalRef.nativeElement) as { show(): void; hide(): void };
    }
    return this.rejectBsModal;
  }

  // Recomputed on each template read rather than cached, so the native
  // picker's upper bound stays current for however long this page is open.
  maxDateTimeLocal(): string {
    return nowDateTimeLocal();
  }

  holdingBarPercent(days: number, threshold: number): number {
    if (threshold <= 0) return 100;
    return Math.min(100, Math.round((days / threshold) * 100));
  }

  lockedStatusLabel(): string {
    const status = this.existingBatch()?.status;
    return status ? this.translation.t(batchStatusLabelKey(status)) : '';
  }

  modeLabelKey(mode: EntryMode | null): string {
    switch (mode) {
      case 'complete': return 'batches.markCompletedBtn';
      default: return 'batches.logMovementBtn';
    }
  }

  onCompletedToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.get('mode')!.setValue(checked ? 'complete' : 'checkin');
  }

  submitConfirmMessage(): string {
    const mode = this.form.get('mode')!.value as EntryMode;
    const batch = this.existingBatch();
    if (mode === 'complete') {
      return this.translation.t('batches.confirmComplete', { department: batch?.currentDepartmentName || '-' });
    }
    return this.translation.t('batches.confirmCheckin', {
      department: this.derivedDepartment()?.name || '-',
      machine: this.selectedMachineLabel() || '-',
    });
  }

  constructor() {
    // Machine → department reverse lookup (the UI no longer lets the user pick
    // a department directly — it's derived from the chosen machine via the new
    // `departments?machineId=` filter).
    this.form.get('machineId')!.valueChanges.pipe(
      distinctUntilChanged(),
      switchMap((machineId) => {
        this.derivedDepartment.set(null);
        this.form.get('departmentId')!.setValue('', { emitEvent: false });
        if (!machineId) {
          this.derivedDepartmentState.set('idle');
          return of(null);
        }
        this.derivedDepartmentState.set('loading');
        const params = new HttpParams().set('machineId', machineId);
        return this.http.get<Page<ReferenceDepartmentItem>>(this.departmentLookupUrl, { params }).pipe(
          map((page) => ({ ok: true as const, dept: page.content[0] ?? null })),
          catchError(() => of({ ok: false as const, dept: null })),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe((result) => {
      if (result === null) {
        this.form.updateValueAndValidity();
        return;
      }
      if (!result.ok) {
        this.derivedDepartmentState.set('error');
      } else if (result.dept) {
        this.derivedDepartment.set(result.dept);
        this.derivedDepartmentState.set('found');
        this.form.get('departmentId')!.setValue(result.dept.id);
      } else {
        this.derivedDepartmentState.set('not-found');
      }
      // The department-lookup outcome lives in a plain signal, not a form
      // control, so a not-found/error result needs an explicit revalidation
      // nudge — only the `found` branch's own setValue() would otherwise
      // trigger the group validators to re-run.
      this.form.updateValueAndValidity();
    });

    // Live batch-number lookup as the user types — mirrors the username/email
    // availability check pattern in the Users module (debounce → request →
    // update state), except this endpoint distinguishes found/not-found by
    // HTTP status (200 vs 404) rather than a boolean response body.
    this.batchNoControl.valueChanges.pipe(
      map((v) => (v ?? '').trim()),
      distinctUntilChanged(),
      tap((batchNo) => {
        if (!batchNo) {
          this.lookupState.set('idle');
          this.existingBatch.set(null);
        } else {
          this.lookupState.set('loading');
        }
      }),
      debounceTime(400),
      switchMap((batchNo) => {
        if (!batchNo) return of(null);
        return this.batchService.getByBatchNo(batchNo).pipe(
          map((batch) => ({ found: true as const, batch })),
          catchError((err: unknown) => of({ found: false as const, err })),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe((result) => {
      if (result === null) return;
      if (result.found) this.applyBatchFound(result.batch);
      else this.applyBatchLookupError(result.err);
    });
  }

  // ── Cross-field pre-validators (soft UX guards; backend remains authoritative) ──

  private locationRequiredValidator(ctrl: AbstractControl): ValidationErrors | null {
    if (ctrl.get('mode')?.value !== 'checkin') return null;
    if (!ctrl.get('machineId')?.value) return { machineRequired: true };
    const deptState = this.derivedDepartmentState();
    if (deptState === 'not-found' || deptState === 'error') return { machineNoDepartment: true };
    if (!ctrl.get('departmentId')?.value) return { departmentPending: true };
    return null;
  }

  private duplicateMachineValidator(ctrl: AbstractControl): ValidationErrors | null {
    if (ctrl.get('mode')?.value !== 'checkin') return null;
    const batch = this.existingBatch();
    const machineId = ctrl.get('machineId')?.value;
    if (!batch || !machineId) return null;
    const duplicate = batch.entries.some((e) => e.machineId === machineId && !e.terminalDepartment);
    return duplicate ? { machineAlreadyLogged: true } : null;
  }

  private departmentAlreadyVisitedValidator(ctrl: AbstractControl): ValidationErrors | null {
    if (ctrl.get('mode')?.value !== 'checkin') return null;
    const batch = this.existingBatch();
    const dept = this.derivedDepartment();
    if (!batch || !dept || dept.terminalDepartment) return null;
    const visited = batch.entries.some((e) => e.departmentId === dept.id);
    return visited ? { departmentAlreadyVisited: true } : null;
  }

  private notAfterLastLogValidator(ctrl: AbstractControl): ValidationErrors | null {
    const batch = this.existingBatch();
    const value = ctrl.get('lineClearanceAt')?.value;
    if (!batch || batch.entries.length === 0 || !value) return null;
    const last = batch.entries[batch.entries.length - 1];
    const selected = new Date(value).getTime();
    const lastLogged = new Date(last.lineClearanceAt).getTime();
    // Matches the backend: only strictly *before* the last log is rejected —
    // the same date/time (or later) is allowed.
    return selected >= lastLogged ? null : { notAfterLastLog: true };
  }

  private notInFutureValidator(ctrl: AbstractControl): ValidationErrors | null {
    const value = ctrl.get('lineClearanceAt')?.value;
    if (!value) return null;
    return new Date(value).getTime() > Date.now() ? { lineClearanceInFuture: true } : null;
  }

  // ── Batch number lookup (driven by the live valueChanges pipeline above) ──

  private applyBatchFound(batch: BatchDetailResponse): void {
    this.existingBatch.set(batch);
    if (batch.status === 'COMPLETED' || batch.status === 'REJECTED') {
      this.lookupState.set('locked');
      return;
    }
    this.lookupState.set('existing');
    this.derivedDepartment.set(null);
    this.derivedDepartmentState.set('idle');
    this.form.reset({
      productId: batch.productId,
      machineId: '',
      departmentId: '',
      mode: 'checkin',
      lineClearanceAt: nowDateTimeLocal(),
    });
    this.form.get('productId')!.disable();
  }

  private applyBatchLookupError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.existingBatch.set(null);
      this.lookupState.set('new');
      this.derivedDepartment.set(null);
      this.derivedDepartmentState.set('idle');
      this.form.reset({
        productId: '',
        machineId: '',
        departmentId: '',
        mode: 'checkin',
        lineClearanceAt: nowDateTimeLocal(),
      });
      this.form.get('productId')!.enable();
    } else {
      this.lookupState.set('error');
      const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v));
      this.toastService.error(message);
    }
  }

  // ── Submit / Reject ───────────────────────────────────────────────────────

  requestSubmit(): void {
    if (this.form.invalid || this.batchNoControl.invalid) {
      this.form.markAllAsTouched();
      this.batchNoControl.markAsTouched();
      this.toastService.error(this.translation.t('users.fixRequiredFields'));
      return;
    }
    this.confirmSubmitModalCmp.open(this.submitConfirmMessage());
  }

  onSubmitConfirmed(): void {
    this.performSubmit();
  }

  private performSubmit(): void {
    const batchNo = (this.batchNoControl.value ?? '').trim();
    const body = this.buildRequest();
    this.submitting.set(true);
    this.batchService.createEntry(batchNo, body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toastService.success(this.translation.t('batches.entryLoggedSuccess'));
        this.router.navigate(['/staff/batches']);
      },
      error: (err) => {
        this.submitting.set(false);
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
      },
    });
  }

  openRejectModal(): void {
    // Reject reuses the entry form's own line-clearance field, which sits
    // behind this modal once it's open — so check it *before* opening rather
    // than letting the user fill in a reason only to be blocked afterward
    // with no visible reason why. If it's invalid, surface that on the main
    // form (where the field actually is) instead of opening the modal.
    const lineClearanceCtrl = this.form.get('lineClearanceAt')!;
    if (lineClearanceCtrl.invalid || this.form.hasError('notAfterLastLog') || this.form.hasError('lineClearanceInFuture')) {
      lineClearanceCtrl.markAsTouched();
      return;
    }
    this.rejectForm.reset({ reason: '' });
    this.rejectLineClearanceError.set(null);
    this.rejectModal?.show();
  }

  confirmReject(): void {
    // Reject reuses the entry form's own line-clearance field rather than
    // asking for a second one — the backend applies the identical validation
    // to it either way, so there's only ever one date/time value on this
    // page, not two duplicated inputs. But that field sits on the page
    // *behind* this modal, so its own inline error is invisible while the
    // modal is open — surface it inside the modal too.
    const lineClearanceCtrl = this.form.get('lineClearanceAt')!;
    const lineClearanceInvalid = lineClearanceCtrl.invalid || this.form.hasError('notAfterLastLog') || this.form.hasError('lineClearanceInFuture');
    if (this.rejectForm.invalid || lineClearanceInvalid) {
      this.rejectForm.markAllAsTouched();
      lineClearanceCtrl.markAsTouched();
      if (lineClearanceInvalid) {
        const code = lineClearanceCtrl.hasError('required')
          ? 'batch.reject.line.clearance.required'
          : this.form.hasError('lineClearanceInFuture')
            ? 'batch.line.clearance.in.future'
            : 'batch.line.clearance.not.after.last.log';
        this.rejectLineClearanceError.set(this.translation.t(code));
      }
      return;
    }
    this.rejectLineClearanceError.set(null);
    // Close the modal right away, same as ConfirmModalComponent's own
    // confirm-then-close pattern — leaving it "open" until the HTTP call
    // resolves means Bootstrap's backdrop is still in the DOM if the user
    // navigates away in the meantime (e.g. on success), which blocks the
    // entire page since Angular's own destroy lifecycle never touches it.
    this.rejectModal?.hide();
    this.performReject();
  }

  private performReject(): void {
    const batch = this.existingBatch();
    if (!batch) return;
    const reason = this.rejectForm.get('reason')!.value ?? '';
    const lineClearanceAt = this.form.get('lineClearanceAt')!.value ?? '';
    const body: RejectBatchRequest = { reason, lineClearanceAt };
    this.rejecting.set(true);
    this.batchService.reject(batch.batchNo, body).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.toastService.success(this.translation.t('batches.rejectSuccess'));
        this.router.navigate(['/staff/batches']);
      },
      error: (err) => {
        this.rejecting.set(false);
        const message = extractErrorMessage(err, (code) => this.translation.errorMessage(code), 'generic', (v) => this.translation.violatorLabel(v));
        this.toastService.error(message);
      },
    });
  }

  private buildRequest(): CreateBatchLogEntryRequest {
    const v = this.form.getRawValue();
    const mode = v.mode as EntryMode;
    return {
      productId: v.productId ?? '',
      departmentId: mode === 'checkin' ? (v.departmentId || null) : null,
      machineId: mode === 'checkin' ? (v.machineId || null) : null,
      lineClearanceAt: v.lineClearanceAt ?? '',
      completed: mode === 'complete',
    };
  }
}
