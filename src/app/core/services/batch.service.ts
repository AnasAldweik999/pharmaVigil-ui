import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.staff';
import {
  BatchDetailResponse,
  BatchListResponse,
  BatchLogEntryResponse,
  CreateBatchLogEntryRequest,
  RejectBatchRequest,
} from '../models/batch.models';
import { Page } from '../models/user.models';
import { AccountType } from '../models/role.models';
import { GridState } from '../../shared/grid/grid.models';
import { SUPPRESS_ERROR_TOAST } from '../interceptors/error-toast.tokens';

// fileReplacements swaps which environment.*.ts backs this import per build,
// and each one narrows portalType to its own literal via `as const` — widen
// it here so comparing against the other portal's literal doesn't trip
// TS2367 ("no overlap") in whichever build didn't produce that literal.
const portalType: AccountType = environment.portalType;

// The date-range picker only produces a plain `YYYY-MM-DD` string, but
// createdAt/lastUpdatedAt are `Instant` on the backend — the specification-arg-resolver
// library's default Instant converter requires a full "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"
// string, so a bare date is rejected. Expand each side of the range to its UTC
// day boundary before it goes on the wire.
const INSTANT_RANGE_FROM_KEYS = new Set(['createdFrom', 'lastUpdatedFrom']);
const INSTANT_RANGE_TO_KEYS = new Set(['createdTo', 'lastUpdatedTo']);

function toInstantBoundary(dateOnly: string, endOfDay: boolean): string {
  return `${dateOnly}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
}

@Injectable({ providedIn: 'root' })
export class BatchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly base = `${this.apiUrl}/api/${portalType === 'STAFF' ? 'staff' : 'supervisor'}/batches`;

  list(state: GridState): Observable<Page<BatchListResponse>> {
    let params = new HttpParams().set('page', state.page.toString()).set('size', state.size.toString());
    if (state.sort) params = params.set('sort', `${state.sort.field},${state.sort.direction}`);
    for (const [k, v] of Object.entries(state.filters)) {
      if (!v) continue;
      if (INSTANT_RANGE_FROM_KEYS.has(k)) params = params.set(k, toInstantBoundary(v, false));
      else if (INSTANT_RANGE_TO_KEYS.has(k)) params = params.set(k, toInstantBoundary(v, true));
      else params = params.set(k, v);
    }
    return this.http.get<Page<BatchListResponse>>(this.base, { params });
  }

  getByBatchNo(batchNo: string): Observable<BatchDetailResponse> {
    return this.http.get<BatchDetailResponse>(`${this.base}/${batchNo}`, { context: this.suppressToast() });
  }

  createEntry(batchNo: string, body: CreateBatchLogEntryRequest): Observable<BatchLogEntryResponse> {
    return this.http.post<BatchLogEntryResponse>(`${this.base}/${batchNo}/entries`, body, { context: this.suppressToast() });
  }

  reject(batchNo: string, body: RejectBatchRequest): Observable<BatchDetailResponse> {
    return this.http.post<BatchDetailResponse>(`${this.base}/${batchNo}/reject`, body, { context: this.suppressToast() });
  }

  deleteEntry(batchNo: string, entryId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${batchNo}/entries/${entryId}`);
  }

  private suppressToast(): HttpContext {
    return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
  }
}
