import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslationService } from '../../../core/services/translation.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { ToastContainerComponent } from '../../../shared/toast/toast-container.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';
import { UserMenuComponent } from '../../../shared/user-menu/user-menu.component';
import { NotificationBellComponent } from '../../../shared/notifications/notification-bell.component';
import { NotificationToastContainerComponent } from '../../../shared/notifications/notification-toast-container.component';

@Component({
  selector: 'app-staff-layout',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent, HasRoleDirective, TranslatePipe,
    LanguageSwitcherComponent, UserMenuComponent, NotificationBellComponent, NotificationToastContainerComponent,
  ],
  templateUrl: './staff-layout.component.html',
})
export class StaffLayoutComponent {
  readonly translation = inject(TranslationService);
  readonly sidebarService = inject(SidebarService);

  readonly sidebarOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
