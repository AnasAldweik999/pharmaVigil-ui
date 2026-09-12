import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  inject,
  input,
  Input,
  OnDestroy,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Page } from '../../core/models/user.models';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-searchable-dropdown',
  templateUrl: './searchable-dropdown.component.html',
  imports: [TranslatePipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableDropdownComponent),
      multi: true,
    },
  ],
})
export class SearchableDropdownComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private readonly http  = inject(HttpClient);
  private readonly elRef = inject(ElementRef);
  readonly translation = inject(TranslationService);

  readonly options = input<any[]>([]);
  // Values to hide from the list regardless of source (static or searched) — e.g.
  // items already picked in sibling rows of a dynamic list, to prevent duplicates.
  readonly excludeValues = input<string[]>([]);
  @Input() searchUrl: string | null = null;
  @Input() searchParam: string = 'name';
  // Extra static query params merged into every remote search request — e.g.
  // scoping a machine picker to a chosen department via `{ departmentId }`.
  readonly extraParams = input<Record<string, string>>({});
  @Input() labelFn: (item: any) => string = (i) => i.label ?? i.name ?? String(i);
  @Input() valueFn:  (item: any) => string = (i) => i.value ?? i.id  ?? String(i);
  @Input() secondaryLabelFn?: (item: any) => string;
  @Input() placeholder: string = '';
  get resolvedPlaceholder(): string { return this.placeholder || this.translation.t('grid.searchEllipsis'); }
  @Input() invalid: boolean = false;
  @Input() small: boolean = true;

  @Input() set value(v: string | undefined) { if (v !== undefined) this.writeValue(v); }
  @Output() valueChange = new EventEmitter<string>();
  @Output() labelChange = new EventEmitter<string>();

  @ViewChild('trigger') triggerEl?:   ElementRef<HTMLElement>;
  @ViewChild('panel')   panelEl?:     ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly _selectedLabel = signal('');
  readonly _selectedValue = signal('');
  readonly _searchText    = signal('');
  readonly _panelOpen     = signal(false);
  readonly _loading       = signal(false);
  readonly _asyncItems    = signal<any[]>([]);
  readonly _disabled      = signal(false);
  readonly _panelTop      = signal(0);
  readonly _panelLeft     = signal(0);
  readonly _panelWidth    = signal(0);
  readonly _panelVisible  = signal(false);
  readonly _itemsMaxHeight = signal(200);
  readonly _loadingMore   = signal(false);
  readonly _hasMorePages  = signal(false);
  private _currentPage = 0;

  readonly _filteredItems = computed(() => {
    const base = this.searchUrl
      ? this._asyncItems()
      : (() => {
          const opts = this.options();
          const text = this._searchText().toLowerCase();
          return text ? opts.filter(o => this.labelFn(o).toLowerCase().includes(text)) : opts;
        })();
    const exclude = this.excludeValues();
    if (exclude.length === 0) return base;
    const excludeSet = new Set(exclude);
    return base.filter(o => !excludeSet.has(this.valueFn(o)));
  });

  private readonly _search$ = new Subject<string>();
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  // Reposition on scroll/resize so the panel tracks the trigger
  private readonly _onScrollOrResize = (): void => this.positionPanel();

  constructor() {
    this._search$.pipe(
      debounceTime(300),
      takeUntilDestroyed(),
    ).subscribe(q => this.fetch(q));

    // writeValue() only receives the raw value (e.g. an id patched onto the
    // form when opening an existing record for edit) — it has no label to
    // show. Resolve it here against the static `options` list once they're
    // available, regardless of whether the value or the options arrive first.
    effect(() => {
      const value = this._selectedValue();
      if (!value || this._selectedLabel()) return;
      const match = this.options().find(o => this.valueFn(o) === value);
      if (match) this._selectedLabel.set(this.labelFn(match));
    });
  }

  // Move the panel out of its normal DOM position so position:fixed is relative to the
  // viewport, not to a transformed ancestor in the layout tree. When nested inside a
  // Bootstrap modal/offcanvas, re-parent to that container (not document.body) — those
  // components install a FocusTrap that yanks focus back to themselves whenever an
  // element outside their own subtree is focused, which would otherwise make the search
  // input unusable (focus bounces away the instant you click into it, so typing does nothing).
  ngAfterViewInit(): void {
    if (this.panelEl?.nativeElement) {
      const host = this.elRef.nativeElement.closest('.modal, .offcanvas') ?? document.body;
      host.appendChild(this.panelEl.nativeElement);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this._onScrollOrResize, { capture: true });
    window.removeEventListener('resize', this._onScrollOrResize);
    const el = this.panelEl?.nativeElement;
    if (el?.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    const target = event.target as Node;
    // Panel lives in <body> outside this component's host — check both
    if (
      !this.elRef.nativeElement.contains(target) &&
      !this.panelEl?.nativeElement.contains(target)
    ) {
      this._closePanel();
    }
  }

  togglePanel(): void {
    if (this._disabled()) return;
    if (this._panelOpen()) {
      this._closePanel();
      return;
    }
    this._searchText.set('');
    this._panelVisible.set(false);
    this._panelOpen.set(true);
    if (this.searchUrl) this.fetch('');
    setTimeout(() => {
      this.positionPanel();
      this._panelVisible.set(true);
      // capture:true catches scroll on any container, not just window
      window.addEventListener('scroll', this._onScrollOrResize, { capture: true, passive: true });
      window.addEventListener('resize', this._onScrollOrResize, { passive: true });
      this.searchInput?.nativeElement.focus();
    }, 0);
  }

  private _closePanel(): void {
    this._panelOpen.set(false);
    this._panelVisible.set(false);
    window.removeEventListener('scroll', this._onScrollOrResize, { capture: true });
    window.removeEventListener('resize', this._onScrollOrResize);
  }

  private positionPanel(): void {
    const rect = this.triggerEl?.nativeElement.getBoundingClientRect();
    if (!rect) return;

    const margin = 8;
    const panelEl = this.panelEl?.nativeElement;
    const headerEl = panelEl?.querySelector<HTMLElement>('.border-bottom');
    const headerHeight = headerEl?.offsetHeight ?? 44;

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < 120 && spaceAbove > spaceBelow;

    const available = Math.max(80, (openAbove ? spaceAbove : spaceBelow) - headerHeight);
    const itemsMaxHeight = Math.min(200, available);
    this._itemsMaxHeight.set(itemsMaxHeight);

    const panelHeight = headerHeight + itemsMaxHeight;
    this._panelTop.set(openAbove ? Math.max(margin, rect.top - panelHeight - 1) : rect.bottom + 1);
    this._panelLeft.set(rect.left);
    this._panelWidth.set(rect.width);
  }

  onSearch(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this._searchText.set(text);
    if (this.searchUrl) this._search$.next(text);
  }

  select(item: any): void {
    const value = this.valueFn(item);
    const label = this.labelFn(item);
    this._selectedValue.set(value);
    this._selectedLabel.set(label);
    this._closePanel();
    this.onChange(value);
    this.onTouched();
    this.valueChange.emit(value);
    this.labelChange.emit(label);
  }

  clear(): void {
    this._selectedValue.set('');
    this._selectedLabel.set('');
    this._closePanel();
    this.onChange('');
    this.onTouched();
    this.valueChange.emit('');
    this.labelChange.emit('');
  }

  writeValue(v: string): void {
    this._selectedValue.set(v ?? '');
    if (!v) this._selectedLabel.set('');
  }

  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this._disabled.set(disabled); }

  // Loads a page of remote results. `page` 0 replaces the list (fresh search
  // or panel open); any later page — only ever triggered by scrolling near
  // the bottom of the list, see `onItemsScroll` — appends to it instead.
  private fetch(q: string, page = 0): void {
    if (!this.searchUrl) return;
    if (page === 0) {
      this._loading.set(true);
    } else {
      this._loadingMore.set(true);
    }
    const params = new URLSearchParams({ [this.searchParam]: q, size: '20', page: String(page), ...this.extraParams() });
    const url = `${this.searchUrl}?${params.toString()}`;
    this.http.get<Page<any> | any[]>(url).subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          // Bare-array responses carry no pagination info — treat as a single page.
          this._asyncItems.set(res);
          this._hasMorePages.set(false);
          this._currentPage = 0;
        } else {
          this._asyncItems.update((items) => (page === 0 ? res.content : [...items, ...res.content]));
          this._hasMorePages.set(!res.last);
          this._currentPage = res.number;
        }
        this._loading.set(false);
        this._loadingMore.set(false);
      },
      error: () => {
        this._loading.set(false);
        this._loadingMore.set(false);
      },
    });
  }

  onItemsScroll(event: Event): void {
    if (!this.searchUrl || this._loading() || this._loadingMore() || !this._hasMorePages()) return;
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) this.fetch(this._searchText(), this._currentPage + 1);
  }
}
