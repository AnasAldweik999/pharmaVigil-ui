import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment.staff';
import { BatchListResponse } from '../../../core/models/batch.models';
import { Page } from '../../../core/models/user.models';
import { GridColumn, GridFilterField, GridState } from '../../../shared/grid/grid.models';
import { GridComponent } from '../../../shared/grid/grid.component';
import { BatchService } from '../../../core/services/batch.service';
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

export interface BatchRow extends BatchListResponse {
  holdingChipStatus: HoldingChipStatus;
}

// Holding Time (batches.component.ts) intentionally only ever shows in-progress
// batches. Log Book is the counterpart that shows every batch regardless of
// status — including COMPLETED/REJECTED — so its status filter keeps all options.
@Component({
  selector: 'app-supervisor-log-book',
  imports: [GridComponent, TranslatePipe],
  templateUrl: './log-book.component.html',
})
export class LogBookComponent {
  private readonly batchService = inject(BatchService);
  private readonly router = inject(Router);
  readonly translation = inject(TranslationService);

  private readonly productSearchUrl = `${environment.apiUrl}/api/supervisor/products`;

  private readonly _pageData = signal<Page<BatchListResponse> | null>(null);
  readonly batches = computed<BatchRow[]>(() =>
    (this._pageData()?.content ?? []).map((b) => ({ ...b, holdingChipStatus: computeHoldingChipStatus(b) })));
  readonly totalElements = computed(() => this._pageData()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this._pageData()?.totalPages ?? 0);

  readonly loading = signal(false);

  readonly gridColumns = computed<GridColumn[]>(() => {
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
      { key: 'currentDepartmentName', label: t('batches.currentDepartment'), sortable: true, sortKey: 'currentDepartment.name', type: 'text' },
      { key: 'currentMachineName', label: t('batches.currentMachine'), sortable: true, sortKey: 'currentMachine.name', type: 'text' },
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

  readonly gridFilters = computed<GridFilterField[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'batchNo', label: t('batches.batchNo'), type: 'text', placeholder: t('batches.searchBatchNo') },
      { key: 'productId', label: t('batches.product'), type: 'searchable-select', searchUrl: this.productSearchUrl, searchParam: 'name' },
      { key: 'status', label: t('batches.status'), type: 'select', options: [
          { label: t('grid.searchEllipsis'), value: '' },
          { label: t('batches.statusInProgress'), value: 'IN_PROGRESS' },
          { label: t('batches.statusCompleted'), value: 'COMPLETED' },
          { label: t('batches.statusRejected'), value: 'REJECTED' },
      ]},
      { key: 'createdBy', label: t('users.createdBy'), type: 'text', placeholder: t('users.searchName') },
      { key: 'createdDateRange', label: t('users.created'), type: 'daterange', fromKey: 'createdFrom', toKey: 'createdTo' },
      { key: 'lastUpdatedBy', label: t('users.lastUpdatedBy'), type: 'text', placeholder: t('users.searchName') },
      { key: 'lastUpdatedDateRange', label: t('users.lastUpdatedAt'), type: 'daterange', fromKey: 'lastUpdatedFrom', toKey: 'lastUpdatedTo' },
    ];
  });

  onGridStateChange(state: GridState): void {
    this.loading.set(true);
    this.batchService.list(state).subscribe({
      next: (page) => { this._pageData.set(page); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onRowClick(row: unknown): void {
    this.router.navigate(['/supervisor/batches', (row as BatchListResponse).batchNo]);
  }
}
