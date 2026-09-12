import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment.staff';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  constructor() {
    this.document.documentElement.setAttribute('data-portal', environment.portalType.toLowerCase());
  }
}
