import { Component, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BatchDetailResponse, BatchLogEntryResponse } from '../../../../core/models/batch.models';
import { BatchService } from '../../../../core/services/batch.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';
import { BatchDetailViewComponent } from '../../../../shared/batch-detail-view/batch-detail-view.component';

@Component({
  selector: 'app-supervisor-batch-detail',
  imports: [RouterLink, TranslatePipe, ConfirmModalComponent, BatchDetailViewComponent],
  templateUrl: './batch-detail.component.html',
})
export class SupervisorBatchDetailComponent {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly translation = inject(TranslationService);

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;
  private pendingEntry: BatchLogEntryResponse | null = null;

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly deleting = signal(false);
  readonly batch = signal<BatchDetailResponse | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const batchNo = params.get('batchNo');
      if (batchNo) this.load(batchNo);
    });
  }

  private load(batchNo: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.batchService.getByBatchNo(batchNo).subscribe({
      next: (batch) => { this.batch.set(batch); this.loading.set(false); },
      error: () => { this.loading.set(false); this.notFound.set(true); },
    });
  }

  onDeleteEntry(entry: BatchLogEntryResponse): void {
    const batch = this.batch();
    if (!batch) return;
    this.pendingEntry = entry;
    const isLastEntry = batch.entries.length === 1;
    const message = entry.isCompleted
      ? this.translation.t('batches.deleteCompletedEntryConfirm')
      : this.translation.t('batches.deleteEntryConfirm', { department: entry.departmentName ?? '-', machine: entry.machineName ?? '-' });
    const warning = isLastEntry ? this.translation.t('batches.deleteLastEntryWarning') : '';
    this.confirmModalCmp.open(message, warning);
  }

  onConfirmModalConfirmed(): void {
    const entry = this.pendingEntry;
    this.pendingEntry = null;
    if (entry) this.performDelete(entry);
  }

  private performDelete(entry: BatchLogEntryResponse): void {
    const batch = this.batch();
    if (!batch) return;
    const wasLastEntry = batch.entries.length === 1;
    this.deleting.set(true);
    this.batchService.deleteEntry(batch.batchNo, entry.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toastService.success(this.translation.t('batches.entryDeletedSuccess'));
        if (wasLastEntry) {
          this.router.navigate(['/supervisor/batches']);
        } else {
          this.load(batch.batchNo);
        }
      },
      error: () => { this.deleting.set(false); },
    });
  }
}
