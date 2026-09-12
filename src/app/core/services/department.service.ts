import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.staff';
import { CreateDepartmentRequest, DepartmentResponse, DepartmentWithBatchesResponse, UpdateDepartmentRequest } from '../models/department.models';
import { Page } from '../models/user.models';
import { GridState } from '../../shared/grid/grid.models';
import { SUPPRESS_ERROR_TOAST } from '../interceptors/error-toast.tokens';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly base = `${this.apiUrl}/api/supervisor/departments`;

  list(state: GridState): Observable<Page<DepartmentResponse>> {
    let params = new HttpParams().set('page', state.page.toString()).set('size', state.size.toString());
    if (state.sort) params = params.set('sort', `${state.sort.field},${state.sort.direction}`);
    for (const [k, v] of Object.entries(state.filters)) {
      if (v) params = params.set(k, v);
    }
    return this.http.get<Page<DepartmentResponse>>(this.base, { params });
  }

  listWithBatches(state: GridState, status: 'all' | 'alerted' | 'exceeded'): Observable<Page<DepartmentWithBatchesResponse>> {
    let params = new HttpParams()
      .set('page', state.page.toString())
      .set('size', state.size.toString())
      .set('status', status);
    if (state.sort) params = params.set('sort', `${state.sort.field},${state.sort.direction}`);
    for (const [k, v] of Object.entries(state.filters)) {
      if (v) params = params.set(k, v);
    }
    return this.http.get<Page<DepartmentWithBatchesResponse>>(`${this.base}/with-batches`, { params });
  }

  getById(id: string): Observable<DepartmentResponse> {
    return this.http.get<DepartmentResponse>(`${this.base}/${id}`);
  }

  getAllowedUnits(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/allowed-units`);
  }

  create(body: CreateDepartmentRequest): Observable<DepartmentResponse> {
    return this.http.post<DepartmentResponse>(this.base, body, { context: this.suppressToast() });
  }

  update(id: string, body: UpdateDepartmentRequest): Observable<DepartmentResponse> {
    return this.http.put<DepartmentResponse>(`${this.base}/${id}`, body, { context: this.suppressToast() });
  }

  toggleActive(id: string): Observable<DepartmentResponse> {
    return this.http.patch<DepartmentResponse>(`${this.base}/${id}/active`, {});
  }

  private suppressToast(): HttpContext {
    return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
  }
}
