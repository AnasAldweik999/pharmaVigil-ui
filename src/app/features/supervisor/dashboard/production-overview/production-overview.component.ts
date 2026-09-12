import { Component } from '@angular/core';
import { SmartComparisonTabComponent } from '../smart-comparison-tab/smart-comparison-tab.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-production-overview',
  imports: [SmartComparisonTabComponent, TranslatePipe],
  templateUrl: './production-overview.component.html',
})
export class ProductionOverviewComponent {}
