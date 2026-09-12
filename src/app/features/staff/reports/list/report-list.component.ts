import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment.staff';
import { Page } from '../../../../core/models/user.models';
import { WorkReportResponse } from '../../../../core/models/work-report.models';
import { GridColumn, GridFilterField, GridState } from '../../../../shared/grid/grid.models';
import { GridComponent } from '../../../../shared/grid/grid.component';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-report-list',
  imports: [GridComponent, RouterLink, TranslatePipe],
  templateUrl: './report-list.component.html',
})
export class ReportListComponent {
  private readonly http    = inject(HttpClient);
  private readonly base    = environment.apiUrl;
  private readonly router  = inject(Router);
  readonly translation     = inject(TranslationService);

  private readonly _pageData = signal<Page<WorkReportResponse> | null>(null);
  readonly rows          = computed(() => this._pageData()?.content ?? []);
  readonly totalElements = computed(() => this._pageData()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this._pageData()?.totalPages ?? 0);

  readonly loading    = signal(false);

  private _currentState: GridState = { filters: {}, sort: null, page: 0, size: 10 };

  readonly gridColumns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'reportDate', label: t('reports.date'),      sortable: true, type: 'text' },
      { key: 'shiftName',  label: t('dashboard.shift'),    sortable: false, type: 'text' },
      { key: 'createdAt',  label: t('reports.submitted'),  sortable: true, type: 'date' },
    ];
  });

  readonly gridFilters = computed<GridFilterField[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'dateRange', label: t('reports.date'), type: 'daterange', fromKey: 'fromDate', toKey: 'toDate' },
      {
        key: 'shiftId',
        label: t('dashboard.shift'),
        type: 'searchable-select',
        searchUrl: `${this.base}/api/staff/reference/shifts`,
        searchParam: 'name',
        labelFn: (s: any) => s.name,
        valueFn: (s: any) => s.id,
        placeholder: t('reports.searchShift'),
      },
    ];
  });

  onGridStateChange(state: GridState): void {
    this._currentState = state;
    this.loadReports(state);
  }

  onRowClick(row: unknown): void {
    const report = row as WorkReportResponse;
    this.router.navigate(['/staff/reports', report.id]);
  }

  private loadReports(state: GridState): void {
    this.loading.set(true);
    let p = new HttpParams()
      .set('page', state.page.toString())
      .set('size', state.size.toString());
    if (state.sort) p = p.set('sort', `${state.sort.field},${state.sort.direction}`);
    for (const [k, v] of Object.entries(state.filters)) { if (v) p = p.set(k, v); }
    this.http.get<Page<WorkReportResponse>>(`${this.base}/api/staff/work-reports`, { params: p }).subscribe({
      next:  (page) => { this._pageData.set(page); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
