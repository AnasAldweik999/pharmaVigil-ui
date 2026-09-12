import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment.staff';
import { ProductItem } from '../../../core/models/product.models';
import { Page } from '../../../core/models/user.models';
import { GridColumn, GridFilterField, GridState } from '../../../shared/grid/grid.models';
import { GridComponent } from '../../../shared/grid/grid.component';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-supervisor-products',
  imports: [RouterLink, GridComponent, TranslatePipe],
  templateUrl: './products.component.html',
})
export class ProductsComponent {
  private readonly http     = inject(HttpClient);
  private readonly router   = inject(Router);
  readonly translation      = inject(TranslationService);
  private readonly apiUrl   = environment.apiUrl;
  private readonly endpoint = `${this.apiUrl}/api/supervisor/products`;

  private readonly _pageData = signal<Page<ProductItem> | null>(null);
  readonly items         = computed(() => this._pageData()?.content ?? []);
  readonly totalElements = computed(() => this._pageData()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this._pageData()?.totalPages ?? 0);

  readonly loading    = signal(false);

  readonly gridColumns = computed<GridColumn[]>(() => [
    { key: 'name',      label: this.translation.t('users.name'),      sortable: true, type: 'text' },
    { key: 'active',    label: this.translation.t('users.status'),    sortable: true, type: 'badge',
      badgeClass: (v) => v === 'true' ? 'pv-chip pv-chip--success' : 'pv-chip pv-chip--danger',
      badgeLabel: (v) => v === 'true' ? this.translation.t('users.active') : this.translation.t('users.inactive') },
    { key: 'createdAt', label: this.translation.t('users.created'),   sortable: true, type: 'date' },
    { key: 'createdBy', label: this.translation.t('users.createdBy'), sortable: true, type: 'text' },
    { key: 'lastUpdatedAt', label: this.translation.t('users.lastUpdatedAt'), sortable: true, type: 'date' },
    { key: 'lastUpdatedBy', label: this.translation.t('users.lastUpdatedBy'), sortable: true, type: 'text' },
  ]);

  readonly gridFilters = computed<GridFilterField[]>(() => [
    { key: 'name', label: this.translation.t('users.name'), type: 'text', placeholder: this.translation.t('users.searchName') },
  ]);

  onGridStateChange(state: GridState): void {
    this.loadItems(state);
  }

  onRowClick(row: unknown): void {
    this.router.navigate(['/supervisor/products', (row as ProductItem).id]);
  }

  loadItems(state: GridState): void {
    this.loading.set(true);
    this.http.get<Page<ProductItem>>(this.endpoint, { params: this.buildParams(state) }).subscribe({
      next: (page) => { this._pageData.set(page); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private buildParams(state: GridState): HttpParams {
    let p = new HttpParams().set('page', state.page.toString()).set('size', state.size.toString());
    if (state.sort) p = p.set('sort', `${state.sort.field},${state.sort.direction}`);
    for (const [k, v] of Object.entries(state.filters)) { if (v) p = p.set(k, v); }
    return p;
  }
}
