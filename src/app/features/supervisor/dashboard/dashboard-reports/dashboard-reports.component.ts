import { Component } from '@angular/core';
import { ReportsTabComponent } from '../reports-tab/reports-tab.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-dashboard-reports',
  imports: [ReportsTabComponent, TranslatePipe],
  templateUrl: './dashboard-reports.component.html',
})
export class DashboardReportsComponent {}
