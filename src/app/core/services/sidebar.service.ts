import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'pv-sidebar-collapsed';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  readonly collapsed = signal(this.readStored());

  toggle(): void {
    this.setCollapsed(!this.collapsed());
  }

  private setCollapsed(value: boolean): void {
    this.collapsed.set(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  }

  private readStored(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }
}
