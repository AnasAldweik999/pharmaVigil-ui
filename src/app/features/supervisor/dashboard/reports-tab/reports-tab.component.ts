import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { Page } from '../../../../core/models/user.models';
import { SupervisorReportListItem } from '../../../../core/models/supervisor.models';
import { GridColumn, GridFilterField, GridState } from '../../../../shared/grid/grid.models';
import { GridComponent } from '../../../../shared/grid/grid.component';
import { TranslationService } from '../../../../core/services/translation.service';

@Component({
  selector: 'app-reports-tab',
  imports: [GridComponent],
  templateUrl: './reports-tab.component.html',
})
export class ReportsTabComponent {
  private readonly http        = inject(HttpClient);
  private readonly router      = inject(Router);
  private readonly base        = environment.apiUrl;
  private readonly translation = inject(TranslationService);

  private readonly _pageData = signal<Page<SupervisorReportListItem> | null>(null);
  get rows()          { return this._pageData()?.content ?? []; }
  get totalElements() { return this._pageData()?.totalElements ?? 0; }
  get totalPages()    { return this._pageData()?.totalPages ?? 0; }
  readonly loading = signal(false);

  private _state: GridState = { filters: {}, sort: null, page: 0, size: 10 };

  readonly gridColumns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'staffName',     label: t('dashboard.staffName'),   sortable: true,  type: 'text' },
      { key: 'staffUsername', label: t('dashboard.username'),    sortable: false, type: 'text', hidden: true },
      { key: 'staffEmail',    label: t('dashboard.email'),       sortable: true,  type: 'text', hidden: true },
      { key: 'reportDate',    label: t('dashboard.workingDate'), sortable: true,  type: 'text' },
      { key: 'shiftName',     label: t('dashboard.shift'),       sortable: true,  type: 'text' },
      { key: 'createdAt',     label: t('reports.submittedAt'),   sortable: true,  type: 'date' },
    ];
  });

  readonly gridFilters = computed<GridFilterField[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'dateRange', label: t('dashboard.workingDate'), type: 'daterange', fromKey: 'fromDate', toKey: 'toDate' },
      {
        key: 'shiftId',
        label: t('dashboard.shift'),
        type: 'searchable-select',
        searchUrl: `${this.base}/api/supervisor/shifts`,
        searchParam: 'name',
        labelFn: (s: any) => s.name,
        valueFn: (s: any) => s.id,
        placeholder: t('reports.searchShift'),
      },
      {
        key: 'staffEmail',
        label: t('dashboard.staff'),
        type: 'searchable-select',
        searchUrl: `${this.base}/api/supervisor/staff-users`,
        searchParam: 'search',
        labelFn: (u: any) => u.name,
        secondaryLabelFn: (u: any) => u.email,
        valueFn: (u: any) => u.email,
        placeholder: t('reports.searchStaff'),
      },
    ];
  });

  onGridStateChange(state: GridState): void {
    this._state = state;
    this.load(state);
  }

  onRowClick(row: unknown): void {
    const item = row as SupervisorReportListItem;
    this.router.navigate(['/supervisor/dashboard/reports', item.id]);
  }

  load(state: GridState = this._state): void {
    this.loading.set(true);
    this.http.get<Page<SupervisorReportListItem>>(`${this.base}/api/supervisor/work-reports`, {
      params: this.buildParams(state),
    }).subscribe({
      next: (page) => { this._pageData.set(page); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private buildParams(state: GridState): HttpParams {
    let p = new HttpParams()
      .set('page', state.page.toString())
      .set('size', state.size.toString());
    if (state.sort) p = p.set('sort', `${state.sort.field},${state.sort.direction}`);
    for (const [k, v] of Object.entries(state.filters)) {
      if (v) p = p.set(k, v);
    }
    return p;
  }
}
