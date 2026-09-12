import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment.staff';
import { BatchListResponse } from '../../../core/models/batch.models';
import { DepartmentWithBatchesResponse } from '../../../core/models/department.models';
import { Page } from '../../../core/models/user.models';
import { GridColumn, GridFilterField, GridState } from '../../../shared/grid/grid.models';
import { GridComponent } from '../../../shared/grid/grid.component';
import { BatchService } from '../../../core/services/batch.service';
import { DepartmentService } from '../../../core/services/department.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  batchStatusChipClass,
  batchStatusLabelKey,
  computeHoldingChipStatus,
  holdingChipClass,
  holdingChipLabelKey,
  HoldingChipStatus,
} from '../../../core/utils/batch-status.util';

export type HoldingTab = 'all' | 'alerted' | 'exceeded';

export interface BatchRow extends BatchListResponse {
  holdingChipStatus: HoldingChipStatus;
}

@Component({
  selector: 'app-supervisor-batches',
  imports: [GridComponent, TranslatePipe],
  templateUrl: './batches.component.html',
})
export class SupervisorBatchesComponent {
  private readonly batchService = inject(BatchService);
  private readonly departmentService = inject(DepartmentService);
  private readonly router = inject(Router);
  readonly translation = inject(TranslationService);

  private readonly productSearchUrl = `${environment.apiUrl}/api/supervisor/products`;
  private readonly machineSearchUrl = `${environment.apiUrl}/api/supervisor/machines`;

  readonly tab = signal<HoldingTab>('all');
  readonly selectedDepartment = signal<{ id: string; name: string } | null>(null);
  private lastDeptFilters: Record<string, string> = {};

  private readonly _deptPageData = signal<Page<DepartmentWithBatchesResponse> | null>(null);
  readonly departments       = computed(() => this._deptPageData()?.content ?? []);
  readonly deptTotalElements = computed(() => this._deptPageData()?.totalElements ?? 0);
  readonly deptTotalPages    = computed(() => this._deptPageData()?.totalPages ?? 0);
  readonly deptLoading = signal(false);

  private readonly _batchPageData = signal<Page<BatchListResponse> | null>(null);
  readonly batches = computed<BatchRow[]>(() =>
    (this._batchPageData()?.content ?? []).map((b) => ({ ...b, holdingChipStatus: computeHoldingChipStatus(b) })));
  readonly batchTotalElements = computed(() => this._batchPageData()?.totalElements ?? 0);
  readonly batchTotalPages    = computed(() => this._batchPageData()?.totalPages ?? 0);
  readonly batchLoading = signal(false);

  readonly deptGridColumns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'name', label: t('users.name'), sortable: true, type: 'text' },
      { key: 'terminalDepartment', label: t('departments.terminalDepartment'), sortable: true, type: 'text',
        formatValue: (v) => v === 'true' ? t('common.yes') : t('common.no') },
      { key: 'standardHoldingTime', label: t('departments.standardHoldingTime'), sortable: true, type: 'text' },
    ];
  });

  readonly deptGridFilters = computed<GridFilterField[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'name', label: t('users.name'), type: 'text', placeholder: t('departments.searchName') },
      { key: 'machineId', label: t('batches.machine'), type: 'searchable-select', searchUrl: this.machineSearchUrl, searchParam: 'name' },
      { key: 'productId', label: t('batches.product'), type: 'searchable-select', searchUrl: this.productSearchUrl, searchParam: 'name' },
      { key: 'batchNo', label: t('batches.batchNo'), type: 'text', placeholder: t('batches.searchBatchNo') },
    ];
  });

  readonly batchGridColumns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'batchNo', label: t('batches.batchNo'), sortable: true, type: 'text' },
      { key: 'productName', label: t('batches.product'), sortable: true, sortKey: 'product.name', type: 'text' },
      { key: 'status', label: t('batches.status'), sortable: true, type: 'badge',
        badgeClass: (v) => batchStatusChipClass(v),
        badgeLabel: (v) => t(batchStatusLabelKey(v)) },
      { key: 'holdingChipStatus', label: t('batches.holdingStatus'), sortable: false, type: 'badge',
        badgeClass: (v) => holdingChipClass(v),
        badgeLabel: (v) => t(holdingChipLabelKey(v)) },
      { key: 'currentMachineName', label: t('batches.currentMachine'), sortable: true, sortKey: 'currentMachine.name', type: 'text' },
      // currentDepartmentEnteredAt is a real persisted column on BatchEntity, so it's sortable.
      // The other three holding-time fields below are computed at response-mapping time (no
      // backing column), matching daysSinceFirstLog's existing non-sortable precedent.
      { key: 'currentDepartmentEnteredAt', label: t('batches.currentDepartmentEnteredAt'), sortable: true, type: 'date' },
      { key: 'daysInCurrentDepartment', label: t('batches.daysInCurrentDepartmentCol'), sortable: false, type: 'text' },
      { key: 'effectiveDepartmentHoldingTimeDays', label: t('batches.effectiveHoldingTimeCol'), sortable: false, type: 'text' },
      { key: 'usingExceptionalHoldingTime', label: t('batches.usingExceptionalHoldingTimeCol'), sortable: false, type: 'text',
        formatValue: (v) => v === 'true' ? t('common.yes') : t('common.no') },
      { key: 'firstLoggedAt', label: t('batches.firstLoggedDateCol'), sortable: true, type: 'date' },
      { key: 'daysSinceFirstLog', label: t('batches.daysSinceFirstLogCol'), sortable: false, type: 'text' },
      { key: 'createdAt', label: t('users.created'), sortable: true, type: 'date' },
      { key: 'createdBy', label: t('users.createdBy'), sortable: true, type: 'text' },
      { key: 'lastUpdatedAt', label: t('users.lastUpdatedAt'), sortable: true, type: 'date' },
      { key: 'lastUpdatedBy', label: t('users.lastUpdatedBy'), sortable: true, type: 'text' },
    ];
  });

  readonly batchGridFilters = computed<GridFilterField[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'batchNo', label: t('batches.batchNo'), type: 'text', placeholder: t('batches.searchBatchNo') },
      { key: 'productId', label: t('batches.product'), type: 'searchable-select', searchUrl: this.productSearchUrl, searchParam: 'name' },
      { key: 'status', label: t('batches.status'), type: 'select', options: [
          { label: t('grid.searchEllipsis'), value: '' },
          { label: t('batches.statusInProgress'), value: 'IN_PROGRESS' },
      ]},
      { key: 'createdBy', label: t('users.createdBy'), type: 'text', placeholder: t('users.searchName') },
      { key: 'createdDateRange', label: t('users.created'), type: 'daterange', fromKey: 'createdFrom', toKey: 'createdTo' },
      { key: 'lastUpdatedBy', label: t('users.lastUpdatedBy'), type: 'text', placeholder: t('users.searchName') },
      { key: 'lastUpdatedDateRange', label: t('users.lastUpdatedAt'), type: 'daterange', fromKey: 'lastUpdatedFrom', toKey: 'lastUpdatedTo' },
    ];
  });

  setTab(tab: HoldingTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.selectedDepartment.set(null);
  }

  onDeptGridStateChange(state: GridState): void {
    if (!this.filtersEqual(state.filters, this.lastDeptFilters)) {
      this.lastDeptFilters = { ...state.filters };
      this.selectedDepartment.set(null);
    }
    this.deptLoading.set(true);
    this.departmentService.listWithBatches(state, this.tab()).subscribe({
      next: (page) => { this._deptPageData.set(page); this.deptLoading.set(false); },
      error: () => this.deptLoading.set(false),
    });
  }

  onDeptRowClick(row: unknown): void {
    const dept = row as DepartmentWithBatchesResponse;
    this.selectedDepartment.set({ id: dept.id, name: dept.name });
  }

  onBatchGridStateChange(state: GridState): void {
    const dept = this.selectedDepartment();
    if (!dept) return;
    this.batchLoading.set(true);
    const merged: GridState = {
      ...state,
      filters: { ...state.filters, currentDepartmentId: dept.id, holdingStatus: this.tab() },
    };
    this.batchService.list(merged).subscribe({
      next: (page) => { this._batchPageData.set(page); this.batchLoading.set(false); },
      error: () => this.batchLoading.set(false),
    });
  }

  onBatchRowClick(row: unknown): void {
    this.router.navigate(['/supervisor/batches', (row as BatchListResponse).batchNo]);
  }

  private filtersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k, i) => k === bKeys[i] && a[k] === b[k]);
  }
}
