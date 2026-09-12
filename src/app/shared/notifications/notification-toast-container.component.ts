import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArrivalBatch, NotificationService } from '../../core/services/notification.service';
import { NotificationItem } from '../../core/models/notification.models';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { resolveNotificationLink } from '../../core/utils/notification-links.util';

const MAX_VISIBLE = 3;
const DURATION_MS = 8000;

interface DisplayedToast {
  id: number;
  notification: NotificationItem | null;
  summaryCount: number | null;
}

@Component({
  selector: 'app-notification-toast-container',
  imports: [TranslatePipe],
  templateUrl: './notification-toast-container.component.html',
})
export class NotificationToastContainerComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly translation = inject(TranslationService);

  readonly toasts = signal<DisplayedToast[]>([]);
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    this.notificationService.arrived$.pipe(takeUntilDestroyed()).subscribe((batch) => this.handleArrival(batch));
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  onToastClick(toast: DisplayedToast): void {
    this.dismiss(toast.id);
    if (toast.notification) {
      const item = toast.notification;
      if (!item.read) this.notificationService.markRead(item.id).subscribe();
      const link = resolveNotificationLink(item, this.authService.currentAccountType() ?? 'STAFF');
      if (link) {
        this.router.navigate(link);
        return;
      }
    }
    this.notificationService.requestOpenPanel();
  }

  private handleArrival(batch: ArrivalBatch): void {
    if (batch.totalNew > batch.items.length) {
      this.push({ id: this.nextId++, notification: null, summaryCount: batch.totalNew });
      return;
    }
    for (const item of batch.items) {
      this.push({ id: this.nextId++, notification: item, summaryCount: null });
    }
  }

  private push(toast: DisplayedToast): void {
    this.toasts.update((list) => {
      const next = [...list, toast];
      if (next.length > MAX_VISIBLE) {
        const overflow = next.splice(0, next.length - MAX_VISIBLE);
        overflow.forEach((t) => this.clearTimer(t.id));
      }
      return next;
    });
    this.timers.set(toast.id, setTimeout(() => this.dismiss(toast.id), DURATION_MS));
  }

  private clearTimer(id: number): void {
    const existing = this.timers.get(id);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(id);
    }
  }
}
