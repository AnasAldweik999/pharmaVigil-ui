import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../../environments/environment.staff';
import { WorkReportResponse } from '../../../../core/models/work-report.models';
import { ReportDetailViewComponent } from '../../../../shared/report-detail-view/report-detail-view.component';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-report-detail',
  imports: [RouterLink, ReportDetailViewComponent, TranslatePipe],
  templateUrl: './report-detail.component.html',
})
export class ReportDetailComponent {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly translation = inject(TranslationService);

  readonly loading  = signal(true);
  readonly notFound = signal(false);
  readonly report   = signal<WorkReportResponse | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadReport(id);
    });
  }

  private loadReport(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.http.get<WorkReportResponse>(`${this.base}/api/staff/work-reports/${id}`).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }
}
