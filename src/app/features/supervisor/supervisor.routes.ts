import { Routes } from '@angular/router';
import { SupervisorLayoutComponent } from './layout/supervisor-layout.component';
import { ProductionOverviewComponent } from './dashboard/production-overview/production-overview.component';
import { DashboardReportsComponent } from './dashboard/dashboard-reports/dashboard-reports.component';
import { ReportDetailComponent } from './dashboard/report-detail/report-detail.component';
import { SupervisorUsersComponent } from './users/users.component';
import { UserCreateComponent } from './users/user-create/user-create.component';
import { UserDetailComponent } from './users/user-detail/user-detail.component';
import { MachinesComponent } from './machines/machines.component';
import { MachineCreateComponent } from './machines/machine-create/machine-create.component';
import { MachineDetailComponent } from './machines/machine-detail/machine-detail.component';
import { StopTypesComponent } from './stop-types/stop-types.component';
import { StopTypeCreateComponent } from './stop-types/stop-type-create/stop-type-create.component';
import { StopTypeDetailComponent } from './stop-types/stop-type-detail/stop-type-detail.component';
import { ShiftsComponent } from './shifts/shifts.component';
import { ShiftCreateComponent } from './shifts/shift-create/shift-create.component';
import { ShiftDetailComponent } from './shifts/shift-detail/shift-detail.component';
import { ProductsComponent } from './products/products.component';
import { ProductCreateComponent } from './products/product-create/product-create.component';
import { ProductDetailComponent } from './products/product-detail/product-detail.component';
import { DepartmentsComponent } from './departments/departments.component';
import { DepartmentCreateComponent } from './departments/department-create/department-create.component';
import { DepartmentDetailComponent } from './departments/department-detail/department-detail.component';
import { SupervisorBatchesComponent } from './batches/batches.component';
import { SupervisorBatchDetailComponent } from './batches/batch-detail/batch-detail.component';
import { LogBookComponent } from './log-book/log-book.component';
import { NoAccessComponent } from '../../shared/no-access/no-access.component';
import { roleGuard } from '../../core/guards/role.guard';
import { dashboardLandingGuard, supervisorNoAccessGuard } from '../../core/guards/dashboard-landing.guard';

export const supervisorRoutes: Routes = [
  {
    path: '',
    component: SupervisorLayoutComponent,
    children: [
      {
        path: 'dashboard',
        children: [
          { path: '', pathMatch: 'full', canActivate: [dashboardLandingGuard], children: [] },
          { path: 'production-overview', title: 'PharmaVigil · Production Overview', component: ProductionOverviewComponent, canActivate: [roleGuard], data: { roles: ['DASHBOARD_VIEWER'] } },
          { path: 'reports',             title: 'PharmaVigil · Reports',             component: DashboardReportsComponent,   canActivate: [roleGuard], data: { roles: ['REPORTS_MANAGER'] } },
          { path: 'reports/:id',         title: 'PharmaVigil · Report Details',      component: ReportDetailComponent,       canActivate: [roleGuard], data: { roles: ['REPORTS_MANAGER'] } },
        ],
      },
      { path: 'users',      title: 'PharmaVigil · Users',       component: SupervisorUsersComponent, canActivate: [roleGuard], data: { roles: ['USERS_MANAGER'] } },
      { path: 'users/new',  title: 'PharmaVigil · Create User', component: UserCreateComponent,      canActivate: [roleGuard], data: { roles: ['USERS_MANAGER'] } },
      { path: 'users/:id',  title: 'PharmaVigil · User Details', component: UserDetailComponent,     canActivate: [roleGuard], data: { roles: ['USERS_MANAGER'] } },
      { path: 'products',      title: 'PharmaVigil · Products',      component: ProductsComponent,       canActivate: [roleGuard], data: { roles: ['PRODUCTS_MANAGER'] } },
      { path: 'products/new',  title: 'PharmaVigil · Add Product',   component: ProductCreateComponent,  canActivate: [roleGuard], data: { roles: ['PRODUCTS_MANAGER'] } },
      { path: 'products/:id',  title: 'PharmaVigil · Product Details', component: ProductDetailComponent, canActivate: [roleGuard], data: { roles: ['PRODUCTS_MANAGER'] } },
      { path: 'departments',      title: 'PharmaVigil · Departments',      component: DepartmentsComponent,       canActivate: [roleGuard], data: { roles: ['DEPARTMENTS_MANAGER'] } },
      { path: 'departments/new',  title: 'PharmaVigil · Add Department',   component: DepartmentCreateComponent,  canActivate: [roleGuard], data: { roles: ['DEPARTMENTS_MANAGER'] } },
      { path: 'departments/:id',  title: 'PharmaVigil · Department Details', component: DepartmentDetailComponent, canActivate: [roleGuard], data: { roles: ['DEPARTMENTS_MANAGER'] } },
      { path: 'batches',          title: 'PharmaVigil · Holding Time',   component: SupervisorBatchesComponent,     canActivate: [roleGuard], data: { roles: ['BATCH_TRACKING_MANAGER'] } },
      { path: 'batches/:batchNo', title: 'PharmaVigil · Batch Details',  component: SupervisorBatchDetailComponent, canActivate: [roleGuard], data: { roles: ['BATCH_TRACKING_MANAGER'] } },
      { path: 'log-book',         title: 'PharmaVigil · Log Book',      component: LogBookComponent,               canActivate: [roleGuard], data: { roles: ['BATCH_TRACKING_MANAGER'] } },
      { path: 'machines',      title: 'PharmaVigil · Machines',      component: MachinesComponent,       canActivate: [roleGuard], data: { roles: ['MACHINE_MANAGER'] } },
      { path: 'machines/new',  title: 'PharmaVigil · Add Machine',   component: MachineCreateComponent,  canActivate: [roleGuard], data: { roles: ['MACHINE_MANAGER'] } },
      { path: 'machines/:id',  title: 'PharmaVigil · Machine Details', component: MachineDetailComponent, canActivate: [roleGuard], data: { roles: ['MACHINE_MANAGER'] } },
      { path: 'stop-types',     title: 'PharmaVigil · Stop Types',     component: StopTypesComponent,      canActivate: [roleGuard], data: { roles: ['STOP_TYPES_MANAGER'] } },
      { path: 'stop-types/new', title: 'PharmaVigil · Add Stop Type',  component: StopTypeCreateComponent, canActivate: [roleGuard], data: { roles: ['STOP_TYPES_MANAGER'] } },
      { path: 'stop-types/:id', title: 'PharmaVigil · Stop Type Details', component: StopTypeDetailComponent, canActivate: [roleGuard], data: { roles: ['STOP_TYPES_MANAGER'] } },
      { path: 'shifts',      title: 'PharmaVigil · Shifts',      component: ShiftsComponent,         canActivate: [roleGuard], data: { roles: ['SHIFT_MANAGER'] } },
      { path: 'shifts/new',  title: 'PharmaVigil · Add Shift',   component: ShiftCreateComponent,    canActivate: [roleGuard], data: { roles: ['SHIFT_MANAGER'] } },
      { path: 'shifts/:id',  title: 'PharmaVigil · Shift Details', component: ShiftDetailComponent, canActivate: [roleGuard], data: { roles: ['SHIFT_MANAGER'] } },
      { path: 'no-access',   title: 'PharmaVigil · No Access',   component: NoAccessComponent, canActivate: [supervisorNoAccessGuard] },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
