import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Page, UserResponse } from '../../../core/models/user.models';
import { GridColumn, GridFilterField, GridState } from '../../../shared/grid/grid.models';
import { GridComponent } from '../../../shared/grid/grid.component';
import { UserService } from '../../../core/services/user.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-supervisor-users',
  imports: [GridComponent, RouterLink, TranslatePipe],
  templateUrl: './users.component.html',
})
export class SupervisorUsersComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  readonly translation = inject(TranslationService);

  private readonly _pageData = signal<Page<UserResponse> | null>(null);
  readonly users         = computed(() => this._pageData()?.content ?? []);
  readonly totalElements = computed(() => this._pageData()?.totalElements ?? 0);
  readonly totalPages    = computed(() => this._pageData()?.totalPages ?? 0);

  readonly loading = signal(false);

  private _currentGridState: GridState = { filters: {}, sort: null, page: 0, size: 10 };

  readonly gridColumns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'name',        label: t('users.name'),    sortable: true, type: 'text' },
      { key: 'username',    label: t('users.username'), sortable: true, type: 'text' },
      { key: 'email',       label: t('users.email'),   sortable: true, type: 'text' },
      { key: 'accountType', label: t('users.accountType'), sortable: true, type: 'badge',
        badgeClass: (v) => v === 'SUPERVISOR' ? 'pv-tag pv-tag--supervisor' : 'pv-tag pv-tag--staff',
        badgeLabel: (v) => v === 'SUPERVISOR' ? t('users.supervisor') : t('users.staff') },
      { key: 'status',    label: t('users.status'),  sortable: true, type: 'badge',
        badgeClass: (v) => v === 'ACTIVE' ? 'pv-chip pv-chip--success' : v === 'INACTIVE' ? 'pv-chip pv-chip--danger' : 'pv-chip pv-chip--warning',
        badgeLabel: (v) => v === 'ACTIVE' ? t('users.active') : v === 'INACTIVE' ? t('users.inactive') : v === 'PENDING_EMAIL_VERIFICATION' ? t('users.pendingVerification') : v },
      { key: 'createdAt',     label: t('users.created'),       sortable: true, type: 'date' },
      { key: 'createdBy',     label: t('users.createdBy'),     sortable: true, type: 'text' },
      { key: 'lastUpdatedAt', label: t('users.lastUpdatedAt'), sortable: true, type: 'date' },
      { key: 'lastUpdatedBy', label: t('users.lastUpdatedBy'), sortable: true, type: 'text' },
    ];
  });

  readonly gridFilters = computed<GridFilterField[]>(() => {
    const t = (k: string) => this.translation.t(k);
    return [
      { key: 'name',     label: t('users.name'),     type: 'text',   placeholder: t('users.searchName') },
      { key: 'username', label: t('users.username'), type: 'text',   placeholder: t('users.searchUsername') },
      { key: 'email',    label: t('users.email'),    type: 'text',   placeholder: t('users.searchEmail') },
      { key: 'accountType', label: t('users.accountType'), type: 'select', options: [
          { label: t('users.allAccountTypes'), value: '' },
          { label: t('users.supervisor'),  value: 'SUPERVISOR' },
          { label: t('users.staff'),       value: 'STAFF' },
      ]},
      { key: 'status', label: t('users.status'), type: 'select', options: [
          { label: t('users.allStatuses'),             value: '' },
          { label: t('users.active'),                  value: 'ACTIVE' },
          { label: t('users.inactive'),                value: 'INACTIVE' },
          { label: t('users.pendingVerificationOption'), value: 'PENDING_EMAIL_VERIFICATION' },
      ]},
    ];
  });

  ngOnInit(): void {
    // Initial load is triggered by GridComponent emitting stateChange on init
  }

  onGridStateChange(state: GridState): void {
    this._currentGridState = state;
    this.loadUsers(state);
  }

  onRowClick(row: unknown): void {
    this.router.navigate(['/supervisor/users', (row as UserResponse).id]);
  }

  loadUsers(state: GridState): void {
    this.loading.set(true);
    this.userService.list(state).subscribe({
      next: (page) => {
        this._pageData.set(page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
