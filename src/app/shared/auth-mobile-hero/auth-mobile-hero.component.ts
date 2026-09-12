import { Component } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-auth-mobile-hero',
  imports: [TranslatePipe],
  templateUrl: './auth-mobile-hero.component.html',
  // Layout-transparent for the same reason as AuthBrandPanelComponent —
  // .pv-auth-mobile-bar must stay a direct flex child of .pv-auth-form-panel.
  styles: [':host { display: contents; }'],
})
export class AuthMobileHeroComponent {}
