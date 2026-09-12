import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.staff';
import {
  CreateUserRequest,
  Page,
  UpdateUserRequest,
  UserFieldAvailabilityResponse,
  UserResponse,
} from '../models/user.models';
import { AccountType, RoleOption } from '../models/role.models';
import { GridState } from '../../shared/grid/grid.models';
import { SUPPRESS_ERROR_TOAST } from '../interceptors/error-toast.tokens';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly base = `${this.apiUrl}/api/supervisor/users`;

  list(state: GridState): Observable<Page<UserResponse>> {
    let params = new HttpParams().set('page', state.page.toString()).set('size', state.size.toString());
    if (state.sort) params = params.set('sort', `${state.sort.field},${state.sort.direction}`);
    for (const [k, v] of Object.entries(state.filters)) {
      if (v) params = params.set(k, v);
    }
    return this.http.get<Page<UserResponse>>(this.base, { params });
  }

  getById(id: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.base}/${id}`);
  }

  getRoles(): Observable<RoleOption[]> {
    return this.http.get<RoleOption[]>(`${this.base}/roles`);
  }

  checkEmail(email: string, excludeId?: string): Observable<UserFieldAvailabilityResponse> {
    let params = new HttpParams().set('email', email);
    if (excludeId) params = params.set('excludeId', excludeId);
    return this.http.get<UserFieldAvailabilityResponse>(`${this.base}/check-email`, {
      params,
      context: this.suppressToast(),
    });
  }

  checkUsername(username: string, excludeId?: string): Observable<UserFieldAvailabilityResponse> {
    let params = new HttpParams().set('username', username);
    if (excludeId) params = params.set('excludeId', excludeId);
    return this.http.get<UserFieldAvailabilityResponse>(`${this.base}/check-username`, {
      params,
      context: this.suppressToast(),
    });
  }

  create(accountType: AccountType, body: CreateUserRequest): Observable<UserResponse> {
    const endpoint = accountType === 'SUPERVISOR' ? 'supervisors' : 'staff';
    return this.http.post<UserResponse>(`${this.base}/${endpoint}`, body, { context: this.suppressToast() });
  }

  update(id: string, body: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.base}/${id}`, body, { context: this.suppressToast() });
  }

  toggleActive(id: string): Observable<UserResponse> {
    return this.http.patch<UserResponse>(`${this.base}/${id}/active`, {});
  }

  private suppressToast(): HttpContext {
    return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
  }
}
