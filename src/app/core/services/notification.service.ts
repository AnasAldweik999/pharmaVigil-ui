import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, Subject, Subscription, catchError, of, tap } from 'rxjs';
import { RxStomp, RxStompState, ReconnectionTimeMode } from '@stomp/rx-stomp';
import SockJS from 'sockjs-client';
import { environment } from '../../../environments/environment.staff';
import { NotificationItem, UnreadCountResponse } from '../models/notification.models';
import { Page } from '../models/user.models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { TranslationService } from './translation.service';
import { SUPPRESS_ERROR_TOAST } from '../interceptors/error-toast.tokens';

const NOTIFICATIONS_DESTINATION = '/user/queue/notifications';
// After this many consecutive reconnect attempts fail to ever reach OPEN,
// tell the user once rather than retrying silently forever — the client
// keeps retrying either way, this is purely a one-time notice.
const FAILURE_NOTICE_THRESHOLD = 5;

export interface ArrivalBatch {
  items: NotificationItem[];
  totalNew: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly base = `${environment.apiUrl}/api/notifications`;
  private readonly wsUrl = `${environment.apiUrl}/ws`;

  readonly unreadCount = signal(0);

  // One-shot event stream (not state) of newly-arrived unread notifications —
  // the toast layer subscribes to this to decide what to pop up. Each
  // WebSocket push is exactly one notification, so `totalNew` always equals
  // `items.length` here; the field still exists so the toast container's
  // single-vs-summary logic (written against the old polling batches, which
  // could report more arrivals than bodies fetched) keeps working unchanged.
  private readonly _arrived = new Subject<ArrivalBatch>();
  readonly arrived$ = this._arrived.asObservable();

  // Lets an arrival toast (rendered by a sibling component in the layout)
  // ask the bell to open its panel on click, without the two coupling to
  // each other directly.
  private readonly _openPanelRequests = new Subject<void>();
  readonly openPanelRequests$ = this._openPanelRequests.asObservable();

  requestOpenPanel(): void {
    this._openPanelRequests.next();
  }

  private rxStomp: RxStomp | null = null;
  private messageSub: Subscription | null = null;
  private stateSub: Subscription | null = null;
  private everConnected = false;
  private consecutiveFailures = 0;
  private failureNoticeShown = false;

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      if (this.authService.isAuthenticated()) this.connect();
      else this.disconnect();
    });
  }

  list(unreadOnly: boolean, page: number, size: number): Observable<Page<NotificationItem>> {
    const params = new HttpParams()
      .set('unreadOnly', String(unreadOnly))
      .set('page', String(page))
      .set('size', String(size));
    return this.http.get<Page<NotificationItem>>(this.base, { params, context: this.suppressToast() });
  }

  markRead(id: string): Observable<NotificationItem> {
    return this.http.patch<NotificationItem>(`${this.base}/${id}/read`, {}).pipe(
      tap(() => this.unreadCount.update((c) => Math.max(0, c - 1))),
    );
  }

  markAllRead(): Observable<void> {
    return this.http.patch<void>(`${this.base}/read-all`, {}).pipe(
      tap(() => this.unreadCount.set(0)),
    );
  }

  deleteAll(): Observable<void> {
    return this.http.delete<void>(this.base).pipe(
      tap(() => this.unreadCount.set(0)),
    );
  }

  private connect(): void {
    if (this.rxStomp) return;

    // Seeds the badge once up front; after this it's maintained purely by
    // incrementing on push and decrementing on mark-read/mark-all/delete-all.
    this.fetchInitialCount();

    const rxStomp = new RxStomp();
    rxStomp.configure({
      webSocketFactory: () => new SockJS(this.wsUrl),
      reconnectDelay: 2_000,
      maxReconnectDelay: 30_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      // Called before every connection attempt, including reconnects — reads
      // the token fresh each time rather than capturing it once, so a
      // rotated/refreshed token is picked up automatically and a genuinely
      // dead one doesn't get silently retried forever with stale credentials.
      beforeConnect: (client) => {
        const token = this.authService.getAccessToken();
        client.stompClient.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
    });

    this.stateSub = rxStomp.connectionState$.subscribe((state) => this.handleConnectionState(state));
    this.messageSub = rxStomp.watch(NOTIFICATIONS_DESTINATION).subscribe((message) => {
      this.handlePush(JSON.parse(message.body) as NotificationItem);
    });

    this.rxStomp = rxStomp;
    rxStomp.activate();
  }

  private disconnect(): void {
    // Unsubscribe before deactivating so the resulting CLOSED transition
    // isn't mistaken for a failed reconnect attempt.
    this.stateSub?.unsubscribe();
    this.stateSub = null;
    this.messageSub?.unsubscribe();
    this.messageSub = null;
    this.rxStomp?.deactivate();
    this.rxStomp = null;
    this.unreadCount.set(0);
    this.everConnected = false;
    this.consecutiveFailures = 0;
    this.failureNoticeShown = false;
  }

  private handleConnectionState(state: RxStompState): void {
    if (state === RxStompState.OPEN) {
      this.consecutiveFailures = 0;
      this.failureNoticeShown = false;
      // A reconnect (not the very first connect) may have missed pushes
      // while it was down — reseed the count once rather than trusting the
      // increment/decrement trail across the gap.
      if (this.everConnected) this.fetchInitialCount();
      this.everConnected = true;
    } else if (state === RxStompState.CLOSED) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= FAILURE_NOTICE_THRESHOLD && !this.failureNoticeShown) {
        this.failureNoticeShown = true;
        this.toastService.error(this.translation.t('notifications.connectionLost'));
      }
    }
  }

  private handlePush(item: NotificationItem): void {
    this.unreadCount.update((c) => c + 1);
    this._arrived.next({ items: [item], totalNew: 1 });
  }

  private fetchInitialCount(): void {
    this.http.get<UnreadCountResponse>(`${this.base}/unread-count`, { context: this.suppressToast() }).pipe(
      catchError(() => of(null)),
    ).subscribe((res) => {
      if (res) this.unreadCount.set(res.count);
    });
  }

  private suppressToast(): HttpContext {
    return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
  }
}
