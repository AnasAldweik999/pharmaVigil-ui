import { Component, computed, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal, SimpleChanges } from '@angular/core';
import { GridAction, GridColumn, GridState } from '../../../../../shared/grid/grid.models';
import { GridComponent } from '../../../../../shared/grid/grid.component';
import { SmartComparisonService } from '../../../../../core/services/smart-comparison.service';
import { TranslationService } from '../../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { ProductStopRow, SmartGroupBy } from '../../../../../core/models/smart-comparison.models';

@Component({
  selector: 'app-products-inner-grid',
  imports: [GridComponent, TranslatePipe],
  templateUrl: './products-inner-grid.component.html',
})
export class ProductsInnerGridComponent implements OnInit, OnChanges {
  @Input({ required: true }) baseUrl!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) groupBy!: SmartGroupBy;

  @Output() closed = new EventEmitter<void>();

  private readonly service = inject(SmartComparisonService);
  readonly translation = inject(TranslationService);

  // ── Products grid state ───────────────────────────────────────────────────
  readonly rows          = signal<unknown[]>([]);
  readonly totalElements = signal(0);
  readonly totalPages    = signal(0);
  readonly loading       = signal(false);
  private  currentPage   = 0;
  private  currentSize   = 10;

  readonly gridActions = computed<GridAction[]>(() => [
    { key: 'stops', label: this.translation.t('dashboard.viewStops'), icon: 'stops', btnClass: 'btn-sm btn-outline-warning',
      condition: (row: any) => (row.stopCount ?? 0) > 0 },
  ]);

  readonly columns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    const shared: GridColumn[] = [
      { key: 'machineStatus', label: t('dashboard.status'), type: 'badge',
        badgeClass: v => v === 'RUNNING' ? 'bg-success' : v === 'STOPPED' ? 'bg-danger' : v === 'MAINTENANCE' ? 'bg-warning text-dark' : 'bg-secondary' },
      { key: 'departmentName', label: t('dashboard.department') },
      { key: 'workingDate',    label: t('dashboard.workingDate'), type: 'date-only' },
      { key: 'productName',    label: t('dashboard.product') },
      { key: 'batchNumber',    label: t('dashboard.batchNo') },
      { key: 'output',         label: t('dashboard.output') },
      { key: 'unit',           label: t('dashboard.unit') },
      { key: 'stopCount',      label: t('dashboard.stops') },
      { key: 'duration',       label: t('dashboard.downtimeMin') },
      { key: 'deviation',      label: t('dashboard.deviation') },
      { key: 'hold',           label: t('dashboard.hold') },
      { key: 'consignee',      label: t('dashboard.destination') },
      { key: 'completedStages', label: t('dashboard.completedStages') },
    ];

    switch (this.groupBy) {
      case 'MACHINE':
        return [
          { key: 'staffName',     label: t('dashboard.staffName') },
          { key: 'staffUsername', label: t('dashboard.username'), hidden: true },
          { key: 'staffEmail',    label: t('dashboard.email'), hidden: true },
          { key: 'shiftName',     label: t('dashboard.shift') },
          ...shared,
        ];
      case 'STAFF':
        return [
          { key: 'machineName', label: t('dashboard.machine') },
          { key: 'shiftName',   label: t('dashboard.shift') },
          ...shared,
        ];
      case 'SHIFT':
        return [
          { key: 'machineName',   label: t('dashboard.machine') },
          { key: 'staffName',     label: t('dashboard.staffName') },
          { key: 'staffUsername', label: t('dashboard.username'), hidden: true },
          { key: 'staffEmail',    label: t('dashboard.email'), hidden: true },
          ...shared,
        ];
      case 'DATE':
      default:
        return [
          { key: 'machineName',   label: t('dashboard.machine') },
          { key: 'staffName',     label: t('dashboard.staffName') },
          { key: 'staffUsername', label: t('dashboard.username'), hidden: true },
          { key: 'staffEmail',    label: t('dashboard.email'), hidden: true },
          { key: 'shiftName',     label: t('dashboard.shift') },
          ...shared.filter(c => c.key !== 'workingDate'),
        ];
    }
  });

  // ── Stops sub-grid state ──────────────────────────────────────────────────
  readonly activeStopsUrl = signal<string | null>(null);
  readonly stopsTitle     = signal('');
  readonly stopsRows      = signal<ProductStopRow[]>([]);
  readonly stopsTotal     = signal(0);
  readonly stopsPages     = signal(0);
  readonly stopsLoading   = signal(false);

  readonly stopsColumns = computed<GridColumn[]>(() => [
    { key: 'stopTypeName', label: this.translation.t('dashboard.stopType') },
    { key: 'duration',     label: this.translation.t('dashboard.durationMin') },
    { key: 'note',         label: this.translation.t('dashboard.notes') },
  ]);

  ngOnInit(): void {
    this.load(0, 10);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['baseUrl'] && !changes['baseUrl'].firstChange) {
      this.rows.set([]);
      this.totalElements.set(0);
      this.totalPages.set(0);
      this.activeStopsUrl.set(null);
      this.load(0, 10);
    }
  }

  onStateChange(state: GridState): void {
    this.load(state.page, state.size);
  }

  onStopActionClick(event: { action: GridAction; row: unknown }): void {
    const r   = event.row as any;
    const url = r.stopsLink ?? null;
    if (!url) return;

    if (this.activeStopsUrl() === url) {
      this.activeStopsUrl.set(null);
    } else {
      const batch = r.batchNumber ? ` — ${this.translation.t('dashboard.batch')} ${r.batchNumber}` : '';
      this.stopsTitle.set(`${r.productName ?? ''}${batch}`);
      this.activeStopsUrl.set(url);
      this.loadStops(0, 10);
    }
  }

  onStopsStateChange(state: GridState): void {
    this.loadStops(state.page, state.size);
  }

  private load(page: number, size: number): void {
    this.currentPage = page;
    this.currentSize = size;
    this.loading.set(true);
    this.service.getInnerGrid<any>(this.baseUrl, page, size).subscribe({
      next: res => {
        this.rows.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadStops(page: number, size: number): void {
    const url = this.activeStopsUrl();
    if (!url) return;
    this.stopsLoading.set(true);
    this.service.getInnerGrid<ProductStopRow>(url, page, size).subscribe({
      next: res => {
        this.stopsRows.set(res.content);
        this.stopsTotal.set(res.totalElements);
        this.stopsPages.set(res.totalPages);
        this.stopsLoading.set(false);
      },
      error: () => this.stopsLoading.set(false),
    });
  }
}
