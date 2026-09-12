import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { GridColumn, GridAction, GridState } from '../../../../shared/grid/grid.models';
import { GridComponent } from '../../../../shared/grid/grid.component';
import { DateRangePickerComponent } from '../../../../shared/date-range-picker/date-range-picker.component';
import { MultiSelectComponent } from '../../../../shared/multi-select/multi-select.component';
import { ProductsInnerGridComponent } from './products-inner-grid/products-inner-grid.component';
import { StopMachinesInnerGridComponent } from './stop-machines-inner-grid/stop-machines-inner-grid.component';
import { SmartComparisonService } from '../../../../core/services/smart-comparison.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { environment } from '../../../../../environments/environment.staff';
import { AnyGroupRow, SmartGroupBy, StopGroupRow, SummaryCardsData } from '../../../../core/models/smart-comparison.models';

const today  = new Date().toLocaleDateString('en-CA');

@Component({
  selector: 'app-smart-comparison-tab',
  imports: [
    DecimalPipe,
    GridComponent,
    DateRangePickerComponent,
    MultiSelectComponent,
    ProductsInnerGridComponent,
    StopMachinesInnerGridComponent,
    TranslatePipe,
  ],
  templateUrl: './smart-comparison-tab.component.html',
})
export class SmartComparisonTabComponent implements OnInit {
  private readonly service = inject(SmartComparisonService);
  readonly translation = inject(TranslationService);
  protected readonly base  = environment.apiUrl;

  // ── Filter state ──────────────────────────────────────────────────────────
  readonly groupBy          = signal<SmartGroupBy>('MACHINE');
  readonly dateRange        = signal({ from: today, to: today });
  readonly selectedShifts   = signal<string[]>([]);
  readonly selectedStaff    = signal<string[]>([]);
  readonly selectedMachines = signal<string[]>([]);

  readonly dateRangeIncomplete = computed(() => !this.dateRange().from || !this.dateRange().to);

  readonly groupByOptions = computed<{ value: SmartGroupBy; label: string }[]>(() => [
    { value: 'MACHINE', label: this.translation.t('dashboard.machine') },
    { value: 'STAFF',   label: this.translation.t('dashboard.staff')   },
    { value: 'SHIFT',   label: this.translation.t('dashboard.shift')   },
    { value: 'DATE',    label: this.translation.t('dashboard.date')    },
    { value: 'STOP',    label: this.translation.t('dashboard.stops')   },
  ]);

  private sharedMetricCols(): GridColumn[] {
    return [
      { key: 'productCount',    label: this.translation.t('dashboard.products') },
      { key: 'stopCount',       label: this.translation.t('dashboard.stops') },
      { key: 'downtimeMinutes', label: this.translation.t('dashboard.downtimeMin') },
      { key: 'holdCount',       label: this.translation.t('dashboard.holds') },
      { key: 'deviationCount',  label: this.translation.t('dashboard.deviations') },
    ];
  }

  groupByLabel(value: SmartGroupBy): string {
    return this.groupByOptions().find((o) => o.value === value)?.label ?? value;
  }

  // ── Label / value fns for dropdowns ──────────────────────────────────────
  readonly shiftLabelFn  = (s: any) => s.name  as string;
  readonly shiftValueFn  = (s: any) => s.id    as string;
  readonly machLabelFn   = (m: any) => m.name  as string;
  readonly machValueFn   = (m: any) => m.id    as string;
  readonly staffLabelFn  = (u: any) => u.name  as string;
  readonly staffSecondaryLabelFn = (u: any) => (u.username || u.email) as string;
  readonly staffValueFn  = (u: any) => u.id    as string;

  // ── Data state ────────────────────────────────────────────────────────────
  readonly summaryCards    = signal<SummaryCardsData | null>(null);
  readonly groupedDataLink = signal<string | null>(null);
  readonly groupedRows     = signal<AnyGroupRow[]>([]);
  readonly groupedTotal    = signal(0);
  readonly groupedPages    = signal(0);
  readonly loadingSummary  = signal(false);
  readonly loadingGrouped  = signal(false);
  readonly hasLoaded       = signal(false);
  readonly isStale         = signal(false);
  readonly appliedGroupBy  = signal<SmartGroupBy>('MACHINE');

  // ── Inner grid state ──────────────────────────────────────────────────────
  readonly activeProductsId   = signal<string | null>(null);
  readonly productsBaseUrl    = signal<string | null>(null);
  readonly productsTitle      = signal('');
  readonly activeStopId        = signal<string | null>(null);
  readonly stopMachinesBaseUrl = signal<string | null>(null);
  readonly stopMachinesTitle   = signal('');

  @ViewChild('productsRef')     productsRef?: ElementRef<HTMLElement>;
  @ViewChild('stopMachinesRef') stopMachinesRef?: ElementRef<HTMLElement>;

  // ── Grid config ───────────────────────────────────────────────────────────
  readonly gridColumns = computed<GridColumn[]>(() => {
    const t = (k: string) => this.translation.t(k);
    switch (this.appliedGroupBy()) {
      case 'MACHINE': return [
        { key: 'machineName',    label: t('dashboard.machine') },
        { key: 'departmentName', label: t('dashboard.department') },
        ...this.sharedMetricCols(),
      ];
      case 'STAFF':   return [
        { key: 'staffName',     label: t('dashboard.staffName') },
        { key: 'staffUsername', label: t('dashboard.username'), hidden: true },
        { key: 'staffEmail',    label: t('dashboard.email'), hidden: true },
        ...this.sharedMetricCols(),
      ];
      case 'SHIFT':   return [{ key: 'shiftName', label: t('dashboard.shift') }, ...this.sharedMetricCols()];
      case 'DATE':    return [{ key: 'date', label: t('dashboard.date'), type: 'date-only' as const }, ...this.sharedMetricCols()];
      case 'STOP':    return [
        { key: 'stopName',             label: t('dashboard.stop') },
        { key: 'totalMachines',        label: t('dashboard.machines') },
        { key: 'totalProducts',        label: t('dashboard.products') },
        { key: 'totalDowntimeMinutes', label: t('dashboard.downtimeMin') },
      ];
    }
  });

  readonly gridActions = computed<GridAction[]>(() => {
    const t = (k: string) => this.translation.t(k);
    if (this.appliedGroupBy() === 'STOP') {
      return [
        { key: 'machines', label: t('dashboard.machines'), icon: 'machines', btnClass: 'btn-sm btn-outline-primary' },
      ];
    }
    return [
      { key: 'products', label: t('dashboard.products'), icon: 'products', btnClass: 'btn-sm btn-outline-primary' },
    ];
  });

  ngOnInit(): void {
    this.applyFilters();
  }

  private markStale(): void {
    if (this.hasLoaded()) {
      this.isStale.set(true);
    }
  }

  onGroupByChange(value: SmartGroupBy): void {
    this.groupBy.set(value);
    this.markStale();
  }

  onDateRangeChange(range: { from: string; to: string }): void {
    this.dateRange.set(range);
    this.markStale();
  }

  onShiftsChange(values: string[]): void {
    this.selectedShifts.set(values);
    this.markStale();
  }

  onStaffChange(values: string[]): void {
    this.selectedStaff.set(values);
    this.markStale();
  }

  onMachinesChange(values: string[]): void {
    this.selectedMachines.set(values);
    this.markStale();
  }

  applyFilters(): void {
    if (this.dateRangeIncomplete()) return;
    this.isStale.set(false);
    this.appliedGroupBy.set(this.groupBy());
    this.closeInnerGrids();
    this.loadingSummary.set(true);
    const f = {
      groupBy:    this.groupBy(),
      startDate:  this.dateRange().from,
      endDate:    this.dateRange().to,
      shiftIds:   this.selectedShifts().length   ? this.selectedShifts()   : undefined,
      staffIds:   this.selectedStaff().length    ? this.selectedStaff()    : undefined,
      machineIds: this.selectedMachines().length ? this.selectedMachines() : undefined,
    };

    this.service.getSummary(f).subscribe({
      next: res => {
        this.summaryCards.set(res.summaryCards);
        this.groupedDataLink.set(res.groupedDataLink);
        this.hasLoaded.set(true);
        this.loadGrouped(0);
      },
      error: () => {
        this.loadingSummary.set(false);
      },
    });
  }

  onPageChange(state: GridState): void {
    const link = this.groupedDataLink();
    if (!link) return;
    this.loadGrouped(state.page, state.size);
  }

  onActionClick(event: { action: GridAction; row: unknown }): void {
    const r     = event.row as any;
    const id    = this.getRowId(r);
    const title = this.getRowTitle(r);

    if (event.action.key === 'products') {
      if (this.activeProductsId() === id) {
        this.activeProductsId.set(null);
        this.productsBaseUrl.set(null);
      } else {
        this.activeProductsId.set(id);
        this.productsBaseUrl.set(r._links?.['products'] ?? null);
        this.productsTitle.set(title);
        afterNextRender(() => {
          this.productsRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } else if (event.action.key === 'machines') {
      if (this.activeStopId() === id) {
        this.activeStopId.set(null);
        this.stopMachinesBaseUrl.set(null);
      } else {
        this.activeStopId.set(id);
        this.stopMachinesBaseUrl.set(r._links?.['machines'] ?? null);
        this.stopMachinesTitle.set(title);
        afterNextRender(() => {
          this.stopMachinesRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }

  kpiFontSize(value: number | string): string {
    const len = typeof value === 'string'
      ? value.length
      : (Math.abs(value) >= 1 ? Math.floor(Math.log10(Math.abs(value))) + 1 : 1);
    if (len <= 6)  return 'clamp(1.3rem, 3vw, 2rem)';
    if (len <= 9)  return 'clamp(1rem, 2.5vw, 1.5rem)';
    if (len <= 12) return 'clamp(0.8rem, 2vw, 1.1rem)';
    return 'clamp(0.7rem, 1.5vw, 0.9rem)';
  }

  private loadGrouped(page: number, size = 10): void {
    const link = this.groupedDataLink();
    if (!link) return;
    this.loadingGrouped.set(true);
    this.service.getGrouped(link, page, size).subscribe({
      next: res => {
        this.groupedRows.set(res.content);
        this.groupedTotal.set(res.totalElements);
        this.groupedPages.set(res.totalPages);
        this.loadingSummary.set(false);
        this.loadingGrouped.set(false);
      },
      error: () => {
        this.loadingSummary.set(false);
        this.loadingGrouped.set(false);
      },
    });
  }

  clearResults(): void {
    this.isStale.set(false);
    this.summaryCards.set(null);
    this.groupedRows.set([]);
    this.groupedTotal.set(0);
    this.groupedPages.set(0);
    this.hasLoaded.set(false);
    this.closeInnerGrids();
  }

  private closeInnerGrids(): void {
    this.activeProductsId.set(null);
    this.productsBaseUrl.set(null);
    this.activeStopId.set(null);
    this.stopMachinesBaseUrl.set(null);
  }

  private getRowId(row: any): string {
    switch (this.appliedGroupBy()) {
      case 'MACHINE': return row.machineName ?? '';
      case 'STAFF':   return row.staffEmail  ?? '';
      case 'SHIFT':   return row.shiftName   ?? '';
      case 'DATE':    return row.date        ?? '';
      case 'STOP':    return row.stopName    ?? '';
    }
  }

  private getRowTitle(row: any): string {
    switch (this.appliedGroupBy()) {
      case 'MACHINE': return row.machineName ?? '';
      case 'STAFF':   return row.staffName   ?? row.staffEmail ?? '';
      case 'SHIFT':   return row.shiftName   ?? '';
      case 'DATE':    return row.date        ?? '';
      case 'STOP':    return row.stopName    ?? '';
    }
  }
}
