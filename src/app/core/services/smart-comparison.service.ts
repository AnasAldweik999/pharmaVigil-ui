import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.staff';
import { AnyGroupRow, ScPageResponse, SmartComparisonFilters, SmartSummaryResponse } from '../models/smart-comparison.models';

@Injectable({ providedIn: 'root' })
export class SmartComparisonService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getSummary(f: SmartComparisonFilters): Observable<SmartSummaryResponse> {
    let params = new HttpParams()
      .set('groupBy',    f.groupBy)
      .set('startDate',  f.startDate)
      .set('endDate',    f.endDate);
    f.shiftIds?.forEach(s   => (params = params.append('shiftIds',   s)));
    f.staffIds?.forEach(e   => (params = params.append('staffIds',   e)));
    f.machineIds?.forEach(m => (params = params.append('machineIds', m)));
    return this.http.get<SmartSummaryResponse>(`${this.base}/api/supervisor/summary`, { params });
  }

  getGrouped(baseUrl: string, page: number, size: number): Observable<ScPageResponse<AnyGroupRow>> {
    const url = this.appendPagination(this.resolve(baseUrl), page, size);
    return this.http.get<ScPageResponse<AnyGroupRow>>(url);
  }

  getInnerGrid<T>(baseUrl: string, page: number, size: number): Observable<ScPageResponse<T>> {
    const url = this.appendPagination(this.resolve(baseUrl), page, size);
    return this.http.get<ScPageResponse<T>>(url);
  }

  private appendPagination(url: string, page: number, size: number): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}page=${page}&size=${size}`;
  }

  private resolve(url: string): string {
    return url.startsWith('/') ? `${this.base}${url}` : url;
  }
}
