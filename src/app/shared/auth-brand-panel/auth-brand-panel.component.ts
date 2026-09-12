import { Component } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-auth-brand-panel',
  imports: [TranslatePipe],
  templateUrl: './auth-brand-panel.component.html',
  // Layout-transparent: .pv-auth-brand must be a direct flex child of
  // .pv-auth-page (fixed width + full-height stretch) — without this the
  // wrapping <app-auth-brand-panel> element breaks that relationship and
  // .pv-auth-brand collapses to its content height instead of the page height.
  styles: [':host { display: contents; }'],
})
export class AuthBrandPanelComponent {}
