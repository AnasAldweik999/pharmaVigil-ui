export function batchStatusChipClass(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'pv-chip pv-chip--success';
    case 'REJECTED': return 'pv-chip pv-chip--danger';
    default: return 'pv-chip pv-chip--warning';
  }
}

export function batchStatusLabelKey(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'batches.statusCompleted';
    case 'REJECTED': return 'batches.statusRejected';
    default: return 'batches.statusInProgress';
  }
}

export type HoldingChipStatus = 'normal' | 'alerted' | 'exceeded';

// Shared by every batch grid (staff Log Sheet, supervisor Holding Time) that
// shows a single combined holding-status chip per row — exceeded always wins
// over merely alerted, on either the general or the department rule.
export function computeHoldingChipStatus(b: {
  generalHoldingExceeded: boolean;
  generalHoldingAlerted: boolean;
  departmentHoldingExceeded: boolean;
  departmentHoldingAlerted: boolean;
}): HoldingChipStatus {
  if (b.generalHoldingExceeded || b.departmentHoldingExceeded) return 'exceeded';
  if (b.generalHoldingAlerted || b.departmentHoldingAlerted) return 'alerted';
  return 'normal';
}

export function holdingChipClass(status: string): string {
  switch (status) {
    case 'exceeded': return 'pv-chip pv-chip--danger';
    case 'alerted': return 'pv-chip pv-chip--warning';
    default: return 'pv-chip pv-chip--neutral';
  }
}

export function holdingChipLabelKey(status: string): string {
  return `batches.holding${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}
