export interface GridColumn {
  key: string;
  label: string;
  sortable?: boolean;
  // The property path sent as the `sort` query param, when it differs from
  // `key` — e.g. a display column reading a flattened `productName` field
  // whose backend sort path is the joined entity's own property (`product.name`).
  // Defaults to `key` when omitted.
  sortKey?: string;
  type?: 'text' | 'date' | 'date-only' | 'badge';
  badgeClass?: (value: string) => string;
  badgeLabel?: (value: string) => string;
  formatValue?: (value: string) => string;
  hidden?: boolean;
}

export interface GridFilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange' | 'searchable-select';
  placeholder?: string;
  options?: { label: string; value: string }[];
  fromKey?: string;
  toKey?: string;
  searchUrl?: string;
  searchParam?: string;
  labelFn?: (item: any) => string;
  valueFn?: (item: any) => string;
  secondaryLabelFn?: (item: any) => string;
}

export interface GridAction {
  key: string;
  label: string;
  btnClass?: string;
  icon?: 'view' | 'edit' | 'delete' | 'deactivate' | 'activate' | 'products' | 'stops' | 'machines';
  condition?: (row: unknown) => boolean;
  confirm?: (row: unknown) => string;
  confirmTitle?: string;
  confirmWarning?: (row: unknown) => string;
}

export interface GridSortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface GridState {
  filters: Record<string, string>;
  sort: GridSortState | null;
  page: number;
  size: number;
}
