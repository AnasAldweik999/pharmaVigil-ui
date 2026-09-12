import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BatchDetailResponse } from '../../../../core/models/batch.models';
import { BatchService } from '../../../../core/services/batch.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { BatchDetailViewComponent } from '../../../../shared/batch-detail-view/batch-detail-view.component';

@Component({
  selector: 'app-staff-batch-detail',
  imports: [RouterLink, TranslatePipe, BatchDetailViewComponent],
  templateUrl: './batch-detail.component.html',
})
export class StaffBatchDetailComponent {
  private readonly batchService = inject(BatchService);
  private readonly route = inject(ActivatedRoute);
  readonly translation = inject(TranslationService);

  readonly loading = signal(true);
  readonly notFound = signal(false);
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
}
