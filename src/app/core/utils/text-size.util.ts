// Shrinks long text down to a smaller size tier instead of truncating it,
// so values (names, batch numbers, etc.) always stay fully readable.
export function getWrapSizeClass(text: string | number | null | undefined): string {
  const len = text != null ? String(text).length : 0;
  if (len > 40) return 'pv-name-xs';
  if (len > 22) return 'pv-name-sm';
  return '';
}

// Numeric output values are visually much "heavier" per character than name
// text (large bold digits), so they need to shrink at far shorter lengths.
export function getWrapOutputSizeClass(text: string | number | null | undefined): string {
  const len = text != null ? String(text).length : 0;
  if (len > 11) return 'pv-name-xs';
  if (len > 7) return 'pv-name-sm';
  return '';
}
