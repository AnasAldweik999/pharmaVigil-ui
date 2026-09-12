import { Component, DestroyRef, ViewChild, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../../environments/environment.staff';
import { WorkReportResponse } from '../../../../core/models/work-report.models';
import { ReportDetailViewComponent } from '../../../../shared/report-detail-view/report-detail-view.component';
import { ConfirmModalComponent } from '../../../../shared/confirm-modal/confirm-modal.component';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-supervisor-report-detail',
  imports: [RouterLink, ReportDetailViewComponent, ConfirmModalComponent, TranslatePipe],
  templateUrl: './report-detail.component.html',
})
export class ReportDetailComponent {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);
  readonly translation = inject(TranslationService);

  @ViewChild('confirmModal') private confirmModalCmp!: ConfirmModalComponent;

  readonly loading  = signal(true);
  readonly notFound = signal(false);
  readonly deleting = signal(false);
  readonly report   = signal<WorkReportResponse | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadReport(id);
    });
  }

  confirmDelete(): void {
    this.confirmModalCmp.open(this.translation.t('reports.deleteReportConfirm'));
  }

  onDeleteConfirmed(): void {
    const report = this.report();
    if (!report) return;
    this.deleting.set(true);
    this.http.delete<void>(`${this.base}/api/supervisor/work-reports/${report.id}`).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toastService.success(this.translation.t('reports.deletedSuccess'));
        this.router.navigate(['/supervisor/dashboard/reports']);
      },
      error: () => this.deleting.set(false),
    });
  }

  private loadReport(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.http.get<WorkReportResponse>(`${this.base}/api/supervisor/work-reports/${id}`).subscribe({
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
