import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BatchDetailResponse } from '../../core/models/batch.models';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-batch-audit-footer',
  imports: [DatePipe, TranslatePipe],
  templateUrl: './batch-audit-footer.component.html',
})
export class BatchAuditFooterComponent {
  @Input({ required: true }) batch!: BatchDetailResponse;
}
