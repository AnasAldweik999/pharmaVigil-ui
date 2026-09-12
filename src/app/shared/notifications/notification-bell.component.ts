import { Component, ElementRef, HostListener, computed, inject, signal, ViewChild, AfterViewChecked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NotificationItem } from '../../core/models/notification.models';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { formatRelativeTime } from '../../core/utils/relative-time.util';
import { resolveNotificationLink } from '../../core/utils/notification-links.util';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-notification-bell',
  imports: [TranslatePipe],
  templateUrl: './notification-bell.component.html',
})
export class NotificationBellComponent implements AfterViewChecked {
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  readonly translation = inject(TranslationService);

  @ViewChild('panel') private panelRef?: ElementRef<HTMLElement>;
  private focusPending = false;

  readonly open = signal(false);
  readonly unreadOnly = signal(false);
  readonly items = signal<NotificationItem[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(false);
  readonly markingAllRead = signal(false);
  readonly clearingAll = signal(false);
  readonly expandedIds = signal<Set<string>>(new Set());
  private currentPage = 0;

  readonly unreadCount = this.notificationService.unreadCount;
  readonly badgeLabel = computed(() => (this.unreadCount() > 9 ? '9+' : String(this.unreadCount())));
  readonly bellAriaLabel = computed(() => {
    const count = this.unreadCount();
    return count > 0
      ? this.translation.t('notifications.bellLabelUnread', { count: String(count) })
      : this.translation.t('notifications.bellLabel');
  });

  constructor() {
    this.notificationService.openPanelRequests$.pipe(takeUntilDestroyed()).subscribe(() => this.openPanel());
    this.notificationService.arrived$.pipe(takeUntilDestroyed()).subscribe((batch) => this.onArrived(batch.items));
  }

  ngAfterViewChecked(): void {
    if (this.focusPending && this.panelRef) {
      this.focusPending = false;
      const first = this.panelRef.nativeElement.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      first?.focus();
    }
  }

  relativeTime(iso: string): string {
    return formatRelativeTime(iso, this.translation);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpand(id: string, event: Event): void {
    event.stopPropagation();
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggle(): void {
    if (this.open()) this.close();
    else this.openPanel();
  }

  openPanel(): void {
    this.open.set(true);
    this.focusPending = true;
    this.loadFirstPage();
  }

  close(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.panelRef) return;
    const focusable = Array.from(
      this.panelRef.nativeElement.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onListKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.pv-notif-item'));
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
    items[Math.max(next, 0)]?.focus();
  }

  setUnreadOnly(value: boolean): void {
    if (this.unreadOnly() === value) return;
    this.unreadOnly.set(value);
    this.loadFirstPage();
  }

  onListScroll(event: Event): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (!nearBottom) return;
    this.loadingMore.set(true);
    this.notificationService.list(this.unreadOnly(), this.currentPage + 1, PAGE_SIZE).subscribe({
      next: (page) => {
        this.items.update((list) => [...list, ...page.content]);
        this.hasMore.set(!page.last);
        this.currentPage = page.number;
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  onItemClick(item: NotificationItem): void {
    if (!item.read) {
      this.notificationService.markRead(item.id).subscribe({ next: (updated) => this.patchItem(updated) });
    }
    const link = resolveNotificationLink(item, this.authService.currentAccountType() ?? 'STAFF');
    if (link) {
      this.close();
      this.router.navigate(link);
    }
  }

  markAllRead(): void {
    if (this.markingAllRead() || this.unreadCount() === 0) return;
    this.markingAllRead.set(true);
    this.notificationService.markAllRead().subscribe({
      next: () => {
        this.markingAllRead.set(false);
        const now = new Date().toISOString();
        if (this.unreadOnly()) {
          this.items.set([]);
        } else {
          this.items.update((list) => list.map((i) => (i.read ? i : { ...i, read: true, readAt: now })));
        }
      },
      error: () => this.markingAllRead.set(false),
    });
  }

  clearAll(): void {
    if (this.clearingAll() || this.items().length === 0) return;
    this.clearingAll.set(true);
    this.notificationService.deleteAll().subscribe({
      next: () => {
        this.clearingAll.set(false);
        this.items.set([]);
        this.hasMore.set(false);
      },
      error: () => this.clearingAll.set(false),
    });
  }

  private loadFirstPage(): void {
    this.loading.set(true);
    this.currentPage = 0;
    this.notificationService.list(this.unreadOnly(), 0, PAGE_SIZE).subscribe({
      next: (page) => {
        this.items.set(page.content);
        this.hasMore.set(!page.last);
        this.currentPage = page.number;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private patchItem(updated: NotificationItem): void {
    this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
  }

  // A push arrives regardless of whether the panel is open. Only reflect it
  // into the visible list live if the panel is actually open — otherwise the
  // next openPanel() call already fetches a fresh first page anyway. New
  // arrivals are always unread, so they belong at the top of either tab.
  private onArrived(items: NotificationItem[]): void {
    if (!this.open() || items.length === 0) return;
    this.items.update((list) => [...items, ...list]);
  }
}
