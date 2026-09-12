import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DepartmentResponse } from '../../../core/models/department.models';
import { Page } from '../../../core/models/user.models';
import { GridColumn, GridFilterField, GridState } from '../../../shared/grid/grid.models';
import { GridComponent } from '../../../shared/grid/grid.component';
import { DepartmentService } from '../../../core/services/department.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-supervisor-departments',
  imports: [GridComponent, RouterLink, TranslatePipe],
  templateUrl: './departments.component.html',
})
export class DepartmentsComponent {
  private readonly departmentService = inject(DepartmentService);
  private readonly router = inject(Router);
  readonly translation = inject(TranslationService);

  private readonly _pageData = signal<Page<DepartmentResponse> | null>(null);
  readonly departments   = computed(() => this._pageData()?.content ?? []);
  readonly totalElements = computed(() => this._pageData()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this._pageData()?.totalPages ?? 0);

  readonly loading = signal(false);

  readonly gridColumns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'name', label: t('users.name'), sortable: true, type: 'text' },
      { key: 'active', label: t('users.status'), sortable: true, type: 'badge',
        badgeClass: (v) => v === 'true' ? 'pv-chip pv-chip--success' : 'pv-chip pv-chip--danger',
        badgeLabel: (v) => v === 'true' ? t('users.active') : t('users.inactive') },
      { key: 'hasOutputs', label: t('departments.hasOutputs'), sortable: true, type: 'text',
        formatValue: (v) => v === 'true' ? t('common.yes') : t('common.no') },
      { key: 'showConsignee', label: t('departments.showConsignee'), sortable: true, type: 'text',
        formatValue: (v) => v === 'true' ? t('common.yes') : t('common.no') },
      { key: 'terminalDepartment', label: t('departments.terminalDepartment'), sortable: true, type: 'text',
        formatValue: (v) => v === 'true' ? t('common.yes') : t('common.no') },
      { key: 'standardHoldingTime', label: t('departments.standardHoldingTime'), sortable: true, type: 'text' },
      { key: 'createdAt', label: t('users.created'),   sortable: true, type: 'date' },
      { key: 'createdBy', label: t('users.createdBy'), sortable: true, type: 'text' },
      { key: 'lastUpdatedAt', label: t('users.lastUpdatedAt'), sortable: true, type: 'date' },
      { key: 'lastUpdatedBy', label: t('users.lastUpdatedBy'), sortable: true, type: 'text' },
    ];
  });

  readonly gridFilters = computed<GridFilterField[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'name',      label: t('users.name'),      type: 'text', placeholder: t('departments.searchName') },
      { key: 'createdBy', label: t('users.createdBy'), type: 'text', placeholder: t('users.searchName') },
      { key: 'hasOutputs', label: t('departments.hasOutputs'), type: 'select', options: [
          { label: t('grid.searchEllipsis'), value: '' },
          { label: t('common.yes'), value: 'true' },
          { label: t('common.no'),  value: 'false' },
      ]},
      { key: 'showConsignee', label: t('departments.showConsignee'), type: 'select', options: [
          { label: t('grid.searchEllipsis'), value: '' },
          { label: t('common.yes'), value: 'true' },
          { label: t('common.no'),  value: 'false' },
      ]},
      { key: 'terminalDepartment', label: t('departments.terminalDepartment'), type: 'select', options: [
          { label: t('grid.searchEllipsis'), value: '' },
          { label: t('common.yes'), value: 'true' },
          { label: t('common.no'),  value: 'false' },
      ]},
    ];
  });

  onGridStateChange(state: GridState): void {
    this.loadDepartments(state);
  }

  onRowClick(row: unknown): void {
    this.router.navigate(['/supervisor/departments', (row as DepartmentResponse).id]);
  }

  loadDepartments(state: GridState): void {
    this.loading.set(true);
    this.departmentService.list(state).subscribe({
      next: (page) => {
        this._pageData.set(page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
