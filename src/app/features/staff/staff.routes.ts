import { Routes } from '@angular/router';
import { StaffLayoutComponent } from './layout/staff-layout.component';
import { ReportListComponent } from './reports/list/report-list.component';
import { ReportCreateComponent } from './reports/create/report-create.component';
import { ReportDetailComponent } from './reports/detail/report-detail.component';
import { StaffBatchesComponent } from './batches/batches.component';
import { BatchLogEntryComponent } from './batches/log-entry/batch-log-entry.component';
import { StaffBatchDetailComponent } from './batches/detail/batch-detail.component';
import { NoAccessComponent } from '../../shared/no-access/no-access.component';
import { roleGuard } from '../../core/guards/role.guard';
import { staffNoAccessGuard } from '../../core/guards/staff-no-access.guard';

export const staffRoutes: Routes = [
  {
    path: '',
    component: StaffLayoutComponent,
    children: [
      { path: 'reports',     title: 'PharmaVigil · My Reports', component: ReportListComponent,   canActivate: [roleGuard], data: { roles: ['FIELD_REPORTER'] } },
      { path: 'reports/new', title: 'PharmaVigil · New Report',  component: ReportCreateComponent, canActivate: [roleGuard], data: { roles: ['FIELD_REPORTER'] } },
      { path: 'reports/:id', title: 'PharmaVigil · Report Details', component: ReportDetailComponent, canActivate: [roleGuard], data: { roles: ['FIELD_REPORTER'] } },
      { path: 'batches',      title: 'PharmaVigil · Log Sheet',         component: StaffBatchesComponent,   canActivate: [roleGuard], data: { roles: ['BATCH_LOG_REPORTER'] } },
      { path: 'batches/log',  title: 'PharmaVigil · Log Batch Movement', component: BatchLogEntryComponent,  canActivate: [roleGuard], data: { roles: ['BATCH_LOG_REPORTER'] } },
      { path: 'batches/:batchNo', title: 'PharmaVigil · Batch Details', component: StaffBatchDetailComponent, canActivate: [roleGuard], data: { roles: ['BATCH_LOG_REPORTER'] } },
      { path: 'no-access',   title: 'PharmaVigil · No Access',   component: NoAccessComponent, canActivate: [staffNoAccessGuard] },
      { path: '', redirectTo: 'reports', pathMatch: 'full' },
    ],
  },
];
