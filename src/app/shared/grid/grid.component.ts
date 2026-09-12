import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DatePipe, isPlatformBrowser, NgClass } from '@angular/common';
import { GridAction, GridColumn, GridFilterField, GridSortState, GridState } from './grid.models';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';
import { SearchableDropdownComponent } from '../searchable-dropdown/searchable-dropdown.component';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-grid',
  imports: [DatePipe, NgClass, DateRangePickerComponent, SearchableDropdownComponent, ConfirmModalComponent, TranslatePipe],
  templateUrl: './grid.component.html',
})
export class GridComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  readonly translation = inject(TranslationService);

  @Input({ required: true }) columns: GridColumn[] = [];
  @Input() filterFields: GridFilterField[] = [];
  @Input() initialFilters: Record<string, string> = {};
  @Input({ required: true }) rows: unknown[] = [];
  @Input() totalElements = 0;
  @Input() totalPages = 0;
  @Input() pageSize = 10;
  @Input() loading = false;
  @Input() pageSizes: number[] = [10, 25, 50];
  @Input() actions: GridAction[] = [];
  @Input() actionsDisabled = false;
  @Input() defaultSort: GridSortState | null = null;
  @Input() clickableRows = false;

  @Output() stateChange  = new EventEmitter<GridState>();
  @Output() actionClick  = new EventEmitter<{ action: GridAction; row: unknown }>();
  @Output() rowClick     = new EventEmitter<unknown>();

  @ViewChild('filterPanel') private filterPanelRef!: ElementRef<HTMLElement>;
  @ViewChild('colPanel')    private colPanelRef!: ElementRef<HTMLElement>;
  @ViewChild(ConfirmModalComponent) private confirmModalCmp!: ConfirmModalComponent;
  private readonly platformId = inject(PLATFORM_ID);
  private bsOffcanvas: { show(): void; hide(): void } | null = null;
  private bsColPanel:  { show(): void; hide(): void } | null = null;

  // ── Action confirmation state ─────────────────────────────────────────────
  private _pendingAction: { action: GridAction; row: unknown } | null = null;
  get confirmTitle(): string    { return this._pendingAction?.action.confirmTitle ?? this.translation.t('grid.confirm'); }
  get confirmLabel(): string    { return this._pendingAction?.action.label ?? this.translation.t('grid.confirm'); }
  get confirmBtnClass(): string {
    return this._pendingAction?.action.btnClass?.includes('danger') ? 'btn-danger' : 'btn-primary';
  }

  // ── Scroll shadow state ───────────────────────────────────────────────────
  private _scrollWrapEl: HTMLElement | null = null;
  readonly showLeftShadow  = signal(false);
  readonly showRightShadow = signal(false);
  readonly actionsColWidth = signal(0);
  private readonly _onWindowResize = () => this.updateScrollShadows();

  @ViewChild('scrollWrap') set scrollWrapRef(ref: ElementRef<HTMLElement> | undefined) {
    this._scrollWrapEl = ref?.nativeElement ?? null;
    this.updateScrollShadows();
  }

  // ── Filter signals ────────────────────────────────────────────────────────
  private readonly _sort           = signal<GridSortState | null>(null);
  private readonly _page           = signal(0);
  private readonly _size           = signal(10);
  private readonly _draftFilters   = signal<Record<string, string>>({});
  private readonly _appliedFilters = signal<Record<string, string>>({});
  private readonly _draftLabels    = signal<Record<string, string>>({});
  private readonly _appliedLabels  = signal<Record<string, string>>({});

  // ── Column visibility signals ─────────────────────────────────────────────
  readonly allColumns   = signal<GridColumn[]>([]);   // all columns (for panel list)
  private readonly _visibleKeys = signal<Set<string>>(new Set());
  private readonly _draftKeys   = signal<Set<string>>(new Set());

  // ── Column resize state ───────────────────────────────────────────────────
  private static readonly MIN_COL_WIDTH = 60;
  private readonly _colWidths = signal<Map<string, number>>(new Map());
  private _resizeKey    = '';
  private _resizeStartX = 0;
  private _resizeStartW = 0;
  private _pendingClientX: number | null = null;
  private _resizeRafId: number | null = null;
  private readonly _onResizeMove = (e: MouseEvent | TouchEvent) => this.handleResizeMove(e);
  private readonly _onResizeUp   = ()                            => this.handleResizeUp();

  readonly defaultLabelFn = (item: any) => item.label ?? item.name ?? String(item);
  readonly defaultValueFn = (item: any) => item.value ?? item.id  ?? String(item);

  searchPlaceholder(label: string): string {
    return this.translation.t('grid.searchPlaceholder', { label });
  }

  readonly sortField     = computed(() => this._sort()?.field ?? null);
  readonly sortDirection = computed(() => this._sort()?.direction ?? null);
  readonly currentPage   = computed(() => this._page());
  readonly currentSize   = computed(() => this._size());
  readonly draftFilters      = this._draftFilters.asReadonly();
  readonly draftFilterCount  = computed(() =>
    Object.values(this._draftFilters()).filter(Boolean).length
  );

  readonly appliedFilterEntries = computed(() => {
    const applied = this._appliedFilters();
    const result: { keys: string[]; label: string; displayValue: string }[] = [];
    for (const field of this.filterFields) {
      if (field.type === 'daterange') {
        const fromVal = field.fromKey ? (applied[field.fromKey] ?? '') : '';
        const toVal   = field.toKey   ? (applied[field.toKey]   ?? '') : '';
        if (!fromVal && !toVal) continue;
        const parts = [fromVal, toVal].filter(Boolean);
        result.push({ keys: [field.fromKey!, field.toKey!], label: field.label, displayValue: parts.join(' → ') });
      } else {
        const value = applied[field.key];
        if (!value) continue;
        let displayValue: string;
        if (field.type === 'select') {
          displayValue = field.options?.find(o => o.value === value)?.label ?? value;
        } else if (field.type === 'searchable-select') {
          displayValue = this._appliedLabels()[field.key] ?? value;
        } else {
          displayValue = value;
        }
        result.push({ keys: [field.key], label: field.label, displayValue });
      }
    }
    return result;
  });

  readonly pageNumbers = computed(() => {
    const total   = this.totalPages;
    const current = this._page();
    if (total <= 1) return [];
    const range: number[] = [];
    const delta = 2;
    const start = Math.max(0, current - delta);
    const end   = Math.min(total - 1, current + delta);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  });

  readonly showingFrom = computed(() => {
    if (this.totalElements === 0) return 0;
    return this._page() * this._size() + 1;
  });

  readonly showingTo = computed(() =>
    Math.min(this._page() * this._size() + this._size(), this.totalElements)
  );

  readonly displayColumns = computed(() =>
    this.allColumns().filter(c => this._visibleKeys().has(c.key))
  );

  readonly hasResizedColumns = computed(() => this._colWidths().size > 0);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns']) {
      const defaultVisible = new Set(this.columns.filter(c => !c.hidden).map(c => c.key));
      this.allColumns.set([...this.columns]);
      this._visibleKeys.set(new Set(defaultVisible));
      this._draftKeys.set(new Set(defaultVisible));

      const newKeys = new Set(this.columns.map(c => c.key));
      this._colWidths.update(widths => {
        const next = new Map<string, number>();
        for (const [key, w] of widths) {
          if (newKeys.has(key)) next.set(key, w);
        }
        return next;
      });
      this.updateScrollShadows();
    }
  }

  ngOnInit(): void {
    this._size.set(this.pageSize);
    if (this.defaultSort) this._sort.set(this.defaultSort);
    if (Object.keys(this.initialFilters).length) {
      this._appliedFilters.set({ ...this.initialFilters });
      this._draftFilters.set({ ...this.initialFilters });
    }
    this.emitState();
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // Move offcanvas panels to <body> so Bootstrap's position:fixed is relative
    // to the viewport — not to a transformed ancestor in the layout tree.
    if (this.filterPanelRef?.nativeElement) {
      document.body.appendChild(this.filterPanelRef.nativeElement);
    }
    if (this.colPanelRef?.nativeElement) {
      document.body.appendChild(this.colPanelRef.nativeElement);
    }
    window.addEventListener('resize', this._onWindowResize, { passive: true });
    this.updateScrollShadows();
  }

  ngOnDestroy(): void {
    // Remove panels that were appended to body
    [this.filterPanelRef, this.colPanelRef].forEach(ref => {
      const el = ref?.nativeElement;
      if (el && el.parentNode === document.body) {
        document.body.removeChild(el);
      }
    });
    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('mouseup',   this._onResizeUp);
    document.removeEventListener('touchmove', this._onResizeMove);
    document.removeEventListener('touchend',    this._onResizeUp);
    document.removeEventListener('touchcancel', this._onResizeUp);
    document.body.classList.remove('pv-resizing');
    if (this._resizeRafId != null) {
      cancelAnimationFrame(this._resizeRafId);
      this._resizeRafId = null;
    }
    window.removeEventListener('resize', this._onWindowResize);
  }

  // ── Filter panel ──────────────────────────────────────────────────────────

  openFilterPanel(): void {
    this._draftFilters.set({ ...this._appliedFilters() });
    this._draftLabels.set({ ...this._appliedLabels() });
    this.offcanvas?.show();
  }

  closeFilterPanel(): void {
    this.offcanvas?.hide();
  }

  onDraftInput(key: string, value: string): void {
    this._draftFilters.update(f => ({ ...f, [key]: value }));
  }

  onDraftDateRange(fromKey: string, toKey: string, from: string, to: string): void {
    this._draftFilters.update(f => ({ ...f, [fromKey]: from, [toKey]: to }));
  }

  onFilterPanelKeydown(event: Event): void {
    if ((event.target as HTMLElement).tagName === 'BUTTON') return;
    event.preventDefault();
    this.applyFilters();
  }

  applyFilters(): void {
    this._appliedFilters.set({ ...this._draftFilters() });
    this._appliedLabels.set({ ...this._draftLabels() });
    this._page.set(0);
    this.emitState();
    this.closeFilterPanel();
  }

  clearAllDraft(): void {
    this._draftFilters.set({});
    this._draftLabels.set({});
  }

  removeFilterKeys(keys: string[]): void {
    this._appliedFilters.update(f => { const n = { ...f }; keys.forEach(k => delete n[k]); return n; });
    this._draftFilters.update(f => { const n = { ...f }; keys.forEach(k => delete n[k]); return n; });
    this._appliedLabels.update(m => { const n = { ...m }; keys.forEach(k => delete n[k]); return n; });
    this._draftLabels.update(m => { const n = { ...m }; keys.forEach(k => delete n[k]); return n; });
    this._page.set(0);
    this.emitState();
  }

  onDraftLabel(key: string, label: string): void {
    this._draftLabels.update(m => ({ ...m, [key]: label }));
  }

  refresh(): void {
    this.emitState();
  }

  sortKeyOf(col: GridColumn): string {
    return col.sortKey ?? col.key;
  }

  onSort(col: GridColumn): void {
    if (!col.sortable) return;
    const field = this.sortKeyOf(col);
    const current = this._sort();
    if (current?.field === field) {
      this._sort.set({ field, direction: current.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      this._sort.set({ field, direction: 'asc' });
    }
    this._page.set(0);
    this.emitState();
  }

  onPageChange(page: number): void {
    this._page.set(page);
    this.emitState();
  }

  onSizeChange(size: number): void {
    this._size.set(size);
    this._page.set(0);
    this.emitState();
  }

  getCell(row: unknown, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  isCellEmpty(row: unknown, key: string): boolean {
    const v = this.getCell(row, key);
    return v === null || v === undefined || v === '';
  }

  // ── Row click ──────────────────────────────────────────────────────────────

  onRowClick(row: unknown): void {
    if (this.clickableRows) this.rowClick.emit(row);
  }

  // ── Action clicks / confirmation ──────────────────────────────────────────

  onActionButtonClick(action: GridAction, row: unknown): void {
    if (action.confirm) {
      this._pendingAction = { action, row };
      this.confirmModalCmp.open(action.confirm(row), action.confirmWarning?.(row));
    } else {
      this.actionClick.emit({ action, row });
    }
  }

  onConfirmAction(): void {
    if (!this._pendingAction) return;
    this.actionClick.emit(this._pendingAction);
    this._pendingAction = null;
  }

  // ── Column visibility panel ───────────────────────────────────────────────

  openColPanel(): void {
    this._draftKeys.set(new Set(this._visibleKeys()));
    this.colPanelInstance?.show();
  }

  closeColPanel(): void {
    this.colPanelInstance?.hide();
  }

  applyColPanel(): void {
    this._visibleKeys.set(new Set(this._draftKeys()));
    this.closeColPanel();
  }

  toggleDraftCol(key: string): void {
    this._draftKeys.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isDraftColChecked(key: string): boolean {
    return this._draftKeys().has(key);
  }

  resetDraftCols(): void {
    this._draftKeys.set(new Set(this.allColumns().filter(c => !c.hidden).map(c => c.key)));
  }

  // ── Column resize ─────────────────────────────────────────────────────────

  getColWidth(key: string): string | null {
    const w = this._colWidths().get(key);
    return w != null ? `${w}px` : null;
  }

  onResizeStart(event: MouseEvent | TouchEvent, key: string): void {
    event.preventDefault();
    event.stopPropagation();
    const th = (event.target as HTMLElement).closest('th') as HTMLElement;
    if (!th) return;

    // Pin every visible column at its current rendered width before the table
    // switches from stretch (100%) to content-driven (max-content) sizing —
    // see .pv-grid-table--resized in styles.css — so siblings don't collapse
    // to min-content the instant the dragged column gets an explicit width.
    // Measured via getBoundingClientRect (fractional), not offsetWidth (which
    // rounds to a whole pixel) — offsetWidth's rounding, applied once as an
    // explicit min-width, was nudging every column by a fraction of a pixel
    // the moment any resize started, since the drag math below is already
    // fractional (derived from clientX) and would then disagree with it.
    const headerRow = th.parentElement;
    if (headerRow) {
      const ths = Array.from(headerRow.querySelectorAll<HTMLElement>('th:not(.pv-grid-actions-th)'));
      const cols = this.displayColumns();
      this._colWidths.update(m => {
        const next = new Map(m);
        ths.forEach((el, i) => {
          const col = cols[i];
          if (col && !next.has(col.key)) next.set(col.key, el.getBoundingClientRect().width);
        });
        return next;
      });
    }

    this._resizeKey    = key;
    this._resizeStartX = this.getClientX(event);
    this._resizeStartW = th.getBoundingClientRect().width;
    document.addEventListener('mousemove', this._onResizeMove);
    document.addEventListener('mouseup',   this._onResizeUp);
    document.addEventListener('touchmove', this._onResizeMove, { passive: false });
    document.addEventListener('touchend',    this._onResizeUp);
    document.addEventListener('touchcancel', this._onResizeUp);
    document.body.classList.add('pv-resizing');
  }

  private getClientX(e: MouseEvent | TouchEvent): number {
    return 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
  }

  private handleResizeMove(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this._pendingClientX = this.getClientX(e);
    if (this._resizeRafId != null) return;
    this._resizeRafId = requestAnimationFrame(() => {
      this._resizeRafId = null;
      if (this._pendingClientX == null) return;
      // The resize handle sits at the column's inline-end edge (see
      // .pv-col-resize-handle's inset-inline-end in styles.css), which is the
      // left edge under RTL — so a leftward drag there must grow the column,
      // the mirror image of LTR. Flip the delta's sign to match.
      const rawDelta = this._pendingClientX - this._resizeStartX;
      const delta = this.translation.dir() === 'rtl' ? -rawDelta : rawDelta;
      const newW = Math.max(
        GridComponent.MIN_COL_WIDTH,
        this._resizeStartW + delta,
      );
      this._colWidths.update(m => { const n = new Map(m); n.set(this._resizeKey, newW); return n; });
    });
  }

  private handleResizeUp(): void {
    document.removeEventListener('mousemove', this._onResizeMove);
    document.removeEventListener('mouseup',   this._onResizeUp);
    document.removeEventListener('touchmove', this._onResizeMove);
    document.removeEventListener('touchend',    this._onResizeUp);
    document.removeEventListener('touchcancel', this._onResizeUp);
    document.body.classList.remove('pv-resizing');
    if (this._resizeRafId != null) {
      cancelAnimationFrame(this._resizeRafId);
      this._resizeRafId = null;
    }
    this._pendingClientX = null;
    this._resizeKey = '';
  }

  // ── Scroll shadow cues ────────────────────────────────────────────────────

  onGridScroll(): void {
    this.updateScrollShadows();
  }

  private updateScrollShadows(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = this._scrollWrapEl;
    if (!el) {
      this.showLeftShadow.set(false);
      this.showRightShadow.set(false);
      return;
    }
    this.showLeftShadow.set(el.scrollLeft > 2);
    this.showRightShadow.set(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    this.actionsColWidth.set(el.querySelector<HTMLElement>('.pv-grid-actions-th')?.offsetWidth ?? 0);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private emitState(): void {
    const cleanFilters: Record<string, string> = {};
    for (const [k, v] of Object.entries(this._appliedFilters())) {
      if (v) cleanFilters[k] = v;
    }
    this.stateChange.emit({
      filters: cleanFilters,
      sort: this._sort(),
      page: this._page(),
      size: this._size(),
    });
  }

  private get offcanvas(): { show(): void; hide(): void } | null {
    if (!isPlatformBrowser(this.platformId) || !this.filterPanelRef?.nativeElement) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BootstrapOffcanvas = (window as any).bootstrap?.Offcanvas;
    if (!BootstrapOffcanvas) return null;
    if (!this.bsOffcanvas) {
      this.bsOffcanvas = new BootstrapOffcanvas(this.filterPanelRef.nativeElement) as {
        show(): void;
        hide(): void;
      };
    }
    return this.bsOffcanvas;
  }

  private get colPanelInstance(): { show(): void; hide(): void } | null {
    if (!isPlatformBrowser(this.platformId) || !this.colPanelRef?.nativeElement) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BootstrapOffcanvas = (window as any).bootstrap?.Offcanvas;
    if (!BootstrapOffcanvas) return null;
    if (!this.bsColPanel) {
      this.bsColPanel = new BootstrapOffcanvas(this.colPanelRef.nativeElement) as {
        show(): void;
        hide(): void;
      };
    }
    return this.bsColPanel;
  }
}
