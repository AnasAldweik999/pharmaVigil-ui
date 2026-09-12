import { Component, Input } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { WorkReportResponse } from '../../core/models/work-report.models';
import { getWrapOutputSizeClass, getWrapSizeClass } from '../../core/utils/text-size.util';
import { parseDuration } from '../../core/utils/duration.util';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-report-detail-view',
  imports: [DatePipe, DecimalPipe, NgClass, TranslatePipe],
  templateUrl: './report-detail-view.component.html',
})
export class ReportDetailViewComponent {
  @Input({ required: true }) report!: WorkReportResponse;
  @Input() showStaffDetails = false;

  readonly getWrapSizeClass = getWrapSizeClass;
  readonly getWrapOutputSizeClass = getWrapOutputSizeClass;
  readonly parseDuration = parseDuration;

  selectedStageNames(stages: Record<string, boolean> | null | undefined): string[] {
    if (!stages) return [];
    return Object.entries(stages).filter(([, v]) => v).map(([k]) => k);
  }
}
