import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { BatchDetailResponse, BatchLogEntryResponse } from '../../core/models/batch.models';
import { TranslatePipe } from '../pipes/translate.pipe';
import { BatchAuditFooterComponent } from '../batch-audit-footer/batch-audit-footer.component';
import { batchStatusChipClass, batchStatusLabelKey } from '../../core/utils/batch-status.util';

export type BatchEntryKind = 'checkin' | 'completed' | 'rejected';

export interface BatchEntryGroup {
  dateKey: string;
  entries: BatchLogEntryResponse[];
}

@Component({
  selector: 'app-batch-detail-view',
  imports: [DatePipe, NgClass, TranslatePipe, BatchAuditFooterComponent],
  templateUrl: './batch-detail-view.component.html',
})
export class BatchDetailViewComponent {
  @Input({ required: true }) batch!: BatchDetailResponse;
  @Input() allowDelete = false;
  @Output() deleteEntry = new EventEmitter<BatchLogEntryResponse>();

  readonly statusChipClass = batchStatusChipClass;
  readonly statusLabelKey = batchStatusLabelKey;

  entryKind(entry: BatchLogEntryResponse): BatchEntryKind {
    if (entry.isRejected) return 'rejected';
    if (entry.isCompleted) return 'completed';
    return 'checkin';
  }

  // Groups the (already chronologically-sorted) entries by calendar day so a
  // repeated date isn't printed on every row — most batches move through
  // several steps within the same shift, so this is the common case.
  groupedEntries(): BatchEntryGroup[] {
    const groups: BatchEntryGroup[] = [];
    for (const entry of this.batch.entries) {
      const dateKey = entry.lineClearanceAt.slice(0, 10);
      const current = groups[groups.length - 1];
      if (current?.dateKey === dateKey) {
        current.entries.push(entry);
      } else {
        groups.push({ dateKey, entries: [entry] });
      }
    }
    return groups;
  }

  isCurrentEntry(entry: BatchLogEntryResponse): boolean {
    const entries = this.batch.entries;
    if (entries.length === 0 || entries[entries.length - 1].id !== entry.id) return false;
    return !entry.isCompleted && !entry.isRejected;
  }

  // Only the most recent entry can be removed — correcting an entry in the
  // middle of the batch's history would silently rewrite everything that
  // came after it, so deletion is restricted to undoing the latest step.
  isDeletable(entry: BatchLogEntryResponse): boolean {
    const entries = this.batch.entries;
    return entries.length > 0 && entries[entries.length - 1].id === entry.id;
  }
}
