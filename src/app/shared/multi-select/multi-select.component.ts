import {
  afterNextRender,
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { Page } from '../../core/models/user.models';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-multi-select',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './multi-select.component.html',
})
export class MultiSelectComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly translation = inject(TranslationService);

  @Input() placeholder = '';
  get resolvedPlaceholder(): string { return this.placeholder || this.translation.t('common.select'); }

  private _options: any[] = [];
  @Input()
  set options(opts: any[]) {
    this._options = opts ?? [];
    this.tryResolveInitial();
  }
  get options(): any[] { return this._options; }

  // Set once, up front, when opening an existing record for edit — resolves
  // against `options` (retrying once they arrive, if they haven't yet) since
  // this component only tracks selection internally and has no other way to
  // be pre-populated.
  private _pendingInitial: string[] | null = null;
  @Input()
  set initialValues(values: string[] | null | undefined) {
    this._pendingInitial = values && values.length ? [...values] : null;
    this.tryResolveInitial();
  }

  @Input() searchUrl: string | null = null;
  @Input() searchParam = 'name';
  @Input() labelFn: (item: any) => string = (item) => item.label ?? item.name ?? String(item);
  @Input() valueFn: (item: any) => string = (item) => item.value ?? item.id ?? String(item);
  @Input() secondaryLabelFn?: (item: any) => string;

  @Output() selectionChange = new EventEmitter<string[]>();

  @ViewChild('container') containerRef!: ElementRef<HTMLElement>;
  @ViewChild('trigger') triggerRef!: ElementRef<HTMLElement>;
  @ViewChild('panel') panelRef!: ElementRef<HTMLElement>;

  private readonly http     = inject(HttpClient);
  private readonly injector = inject(Injector);

  readonly isOpen      = signal(false);
  readonly searchText  = signal('');
  readonly selected    = signal<{ label: string; value: string }[]>([]);
  readonly dynamicOpts = signal<any[]>([]);
  readonly loading     = signal(false);
  readonly loadingMore  = signal(false);
  readonly hasMorePages = signal(false);
  private currentPage = 0;

  // Panel is rendered in <body> via portal (so position:fixed is viewport-relative,
  // escaping any ancestor `overflow: hidden` card) and positioned/flipped to stay
  // within the viewport — mirrors SearchableDropdownComponent's approach.
  readonly panelTop        = signal(0);
  readonly panelLeft       = signal(0);
  readonly panelWidth      = signal(0);
  readonly panelPositioned = signal(false);
  readonly itemsMaxHeight  = signal(220);

  private readonly onScrollOrResizePanel = (): void => this.positionPanel();

  readonly hiddenCount   = signal(0);
  readonly visibleItems  = computed(() =>
    this.selected().slice(0, this.selected().length - this.hiddenCount())
  );
  readonly hiddenItems   = computed(() =>
    this.selected().slice(this.selected().length - this.hiddenCount())
  );
  readonly hiddenTooltip = computed(() =>
    this.hiddenItems().map(i => i.label).join(', ')
  );

  private readonly search$ = new Subject<string>();
  private resizeObserver?: ResizeObserver;

  constructor() {
    effect(() => {
      this.selected();
      this.hiddenCount.set(0);
      afterNextRender(() => this.measureOverflow(), { injector: this.injector });
    });

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(q => this.fetch(q));
  }

  readonly displayOptions = computed(() => {
    if (this.searchUrl) return this.dynamicOpts();
    const q = this.searchText().toLowerCase();
    if (!q) return this.options;
    return this.options.filter(o =>
      this.labelFn(o).toLowerCase().includes(q) ||
      (this.secondaryLabelFn?.(o).toLowerCase().includes(q) ?? false)
    );
  });

  ngOnInit(): void {
    if (this.searchUrl) this.fetch('');
  }

  // Loads a page of remote results. `page` 0 replaces the list (fresh search
  // or panel open); any later page — only ever triggered by scrolling near
  // the bottom of the list, see `onItemsScroll` — appends to it instead.
  private fetch(q: string, page = 0): void {
    if (!this.searchUrl) return;
    if (page === 0) {
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    const params = new URLSearchParams({ [this.searchParam]: q, size: '20', page: String(page) });
    const url = `${this.searchUrl}?${params.toString()}`;
    this.http.get<Page<any> | any[]>(url).subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          // Bare-array responses carry no pagination info — treat as a single page.
          this.dynamicOpts.set(res);
          this.hasMorePages.set(false);
          this.currentPage = 0;
        } else {
          this.dynamicOpts.update((items) => (page === 0 ? res.content : [...items, ...res.content]));
          this.hasMorePages.set(!res.last);
          this.currentPage = res.number;
        }
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  onItemsScroll(event: Event): void {
    if (!this.searchUrl || this.loading() || this.loadingMore() || !this.hasMorePages()) return;
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) this.fetch(this.searchText(), this.currentPage + 1);
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.selected().length > 0) {
        this.hiddenCount.set(0);
        afterNextRender(() => this.measureOverflow(), { injector: this.injector });
      }
    });
    this.resizeObserver.observe(this.containerRef.nativeElement);

    // Re-parent into <body> (or the nearest modal/offcanvas — those trap focus
    // back to their own subtree, which would break the panel's search input).
    const host = this.containerRef.nativeElement.closest('.modal, .offcanvas') ?? document.body;
    host.appendChild(this.panelRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener('scroll', this.onScrollOrResizePanel, { capture: true });
    window.removeEventListener('resize', this.onScrollOrResizePanel);
    const el = this.panelRef?.nativeElement;
    if (el?.parentNode) el.parentNode.removeChild(el);
  }

  private measureOverflow(): void {
    const root = this.containerRef?.nativeElement;
    if (!root) return;

    const items = this.selected();
    if (items.length === 0) { this.hiddenCount.set(0); return; }

    const bubblesEl = root.querySelector<HTMLElement>('.pv-ms-bubbles');
    if (!bubblesEl) return;

    const bubbles = Array.from(
      bubblesEl.querySelectorAll<HTMLElement>('.pv-ms-bubble:not(.pv-ms-bubble--more)')
    );
    if (bubbles.length === 0) return;

    const containerWidth = bubblesEl.clientWidth;
    if (containerWidth === 0) return;

    const CHIP_W = 44; // "+N" chip width estimate including gap
    const gapStyle = getComputedStyle(bubblesEl).columnGap;
    const gap = parseFloat(gapStyle) || 0;

    // Sum bubble widths in DOM order (earliest-selected first) rather than
    // comparing offsetLeft against the container's edge — offsetLeft-based
    // math assumes the flex main axis grows left-to-right, which only holds
    // under [dir="ltr"]. Under [dir="rtl"] the axis is reversed (items pack
    // from the right), so offsetLeft comparisons produced false positives.
    // A pure width sum is direction-agnostic.
    const widths = bubbles.map(b => b.getBoundingClientRect().width);

    let visibleCount = bubbles.length;
    for (let count = bubbles.length; count >= 1; count--) {
      const needsChip = count < items.length;
      const budget = needsChip ? containerWidth - CHIP_W : containerWidth;
      let sum = 0;
      for (let i = 0; i < count; i++) sum += widths[i] + (i > 0 ? gap : 0);
      if (sum <= budget) { visibleCount = count; break; }
      visibleCount = 0;
    }

    const hidden = Math.min(bubbles.length - Math.max(visibleCount, 1), items.length - 1); // always show ≥ 1 bubble
    if (hidden !== this.hiddenCount()) {
      this.hiddenCount.set(hidden);
    }
  }

  private tryResolveInitial(): void {
    if (!this._pendingInitial || this._pendingInitial.length === 0) return;
    if (this._options.length === 0) return;
    const resolved = this._pendingInitial
      .map(v => this._options.find(o => this.valueFn(o) === v))
      .filter((o): o is any => !!o)
      .map(o => ({ label: this.labelFn(o), value: this.valueFn(o) }));
    this._pendingInitial = null;
    if (resolved.length > 0) this.selected.set(resolved);
  }

  toggle(event: MouseEvent): void {
    if (this.isOpen()) {
      this.closePanel();
      return;
    }
    this.isOpen.set(true);
    this.panelPositioned.set(false);
    setTimeout(() => {
      this.positionPanel();
      this.panelPositioned.set(true);
      // capture:true catches scroll on any container, not just window
      window.addEventListener('scroll', this.onScrollOrResizePanel, { capture: true, passive: true });
      window.addEventListener('resize', this.onScrollOrResizePanel, { passive: true });
    }, 0);
  }

  private closePanel(): void {
    this.isOpen.set(false);
    this.panelPositioned.set(false);
    window.removeEventListener('scroll', this.onScrollOrResizePanel, { capture: true });
    window.removeEventListener('resize', this.onScrollOrResizePanel);
  }

  private positionPanel(): void {
    const rect = this.triggerRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;

    const margin = 8;
    const headerEl = this.panelRef?.nativeElement.querySelector<HTMLElement>('.pv-ms-search-wrap');
    const headerHeight = headerEl?.offsetHeight ?? 48;

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < 140 && spaceAbove > spaceBelow;

    const available = Math.max(80, (openAbove ? spaceAbove : spaceBelow) - headerHeight);
    const itemsMax = Math.min(220, available);
    this.itemsMaxHeight.set(itemsMax);

    const panelHeight = headerHeight + itemsMax;
    this.panelTop.set(openAbove ? Math.max(margin, rect.top - panelHeight - 1) : rect.bottom + 4);
    this.panelLeft.set(rect.left);
    this.panelWidth.set(Math.max(rect.width, 220));
  }

  toggleOption(item: any): void {
    const value = this.valueFn(item);
    const label = this.labelFn(item);
    const current = this.selected();
    const idx = current.findIndex(s => s.value === value);
    if (idx >= 0) {
      this.selected.set(current.filter((_, i) => i !== idx));
    } else {
      this.selected.set([...current, { label, value }]);
    }
    this.selectionChange.emit(this.selected().map(s => s.value));
  }

  remove(value: string, event: MouseEvent): void {
    event.stopPropagation();
    this.selected.update(s => s.filter(x => x.value !== value));
    this.selectionChange.emit(this.selected().map(s => s.value));
  }

  clearAll(event: MouseEvent): void {
    event.stopPropagation();
    this.selected.set([]);
    this.selectionChange.emit([]);
  }

  isSelected(value: string): boolean {
    return this.selected().some(s => s.value === value);
  }

  onSearchInput(text: string): void {
    this.searchText.set(text);
    if (this.searchUrl) this.search$.next(text);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    // Panel lives in <body> outside this component's host — check both
    if (
      this.containerRef && !this.containerRef.nativeElement.contains(target) &&
      !this.panelRef?.nativeElement.contains(target)
    ) {
      this.closePanel();
    }
  }
}
