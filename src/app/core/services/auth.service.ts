import { inject, Injectable, PLATFORM_ID, signal, computed } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { catchError, finalize, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment.staff';
import {
  AuthState,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  ResetPasswordRequest,
  SetupUsernameRequest,
} from '../models/auth.models';
import { AccountType, UserRole } from '../models/role.models';
import { decodeAccessTokenRoles } from '../utils/jwt.util';
import { SUPPRESS_ERROR_TOAST } from '../interceptors/error-toast.tokens';

const STORAGE_KEY = 'pv_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = environment.apiUrl;

  private readonly _authState = signal<AuthState | null>(this.loadFromStorage());
  private refreshInProgress$: Observable<LoginResponse> | null = null;

  readonly authState = this._authState.asReadonly();
  readonly isAuthenticated = computed(() => this._authState() !== null);
  readonly currentAccountType = computed(() => this._authState()?.accountType ?? null);
  readonly currentName = computed(() => this._authState()?.name ?? null);
  readonly currentEmail = computed(() => this._authState()?.email ?? null);
  readonly currentUsername = computed(() => this._authState()?.username ?? null);
  readonly currentRoles = computed<UserRole[]>(() => decodeAccessTokenRoles(this._authState()?.accessToken ?? null));

  hasRole(role: UserRole): boolean {
    return this.currentRoles().includes(role);
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    if (roles.length === 0) return true;
    const current = this.currentRoles();
    return roles.some((r) => current.includes(r));
  }

  login(usernameOrEmail: string, password: string, portalType: AccountType): Observable<LoginResponse> {
    const body: LoginRequest = { usernameOrEmail, password, portalType };
    return this.http.post<LoginResponse>(`${this.apiUrl}/api/auth/login`, body, { context: this.suppressToast() }).pipe(
      tap((res) => {
        if (!res.requiresUsernameSetup) this.persist(this.toAuthState(res));
      })
    );
  }

  setupUsername(setupToken: string, username: string): Observable<LoginResponse> {
    const body: SetupUsernameRequest = { setupToken, username };
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/api/auth/setup-username`, body, { context: this.suppressToast() })
      .pipe(tap((res) => this.persist(this.toAuthState(res))));
  }

  logout(): void {
    this.http
      .post<void>(`${this.apiUrl}/api/auth/logout`, {})
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.clear();
        this.router.navigate(['/login']);
      });
  }

  forgotPassword(email: string): Observable<void> {
    const body: ForgotPasswordRequest = { email };
    return this.http.post<void>(`${this.apiUrl}/api/auth/forgot-password`, body, { context: this.suppressToast() });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    const body: ResetPasswordRequest = { token, newPassword };
    return this.http.post<void>(`${this.apiUrl}/api/auth/reset-password`, body, { context: this.suppressToast() });
  }

  refreshToken(): Observable<LoginResponse> {
    if (this.refreshInProgress$) return this.refreshInProgress$;

    const state = this._authState();
    if (!state) return throwError(() => new Error('No refresh token available'));

    const body: RefreshTokenRequest = { refreshToken: state.refreshToken };
    this.refreshInProgress$ = this.http
      .post<LoginResponse>(`${this.apiUrl}/api/auth/refresh`, body, { context: this.suppressToast() })
      .pipe(
        tap((res) => this.persist(this.toAuthState(res))),
        finalize(() => (this.refreshInProgress$ = null)),
        shareReplay(1)
      );
    return this.refreshInProgress$;
  }

  getAccessToken(): string | null {
    return this._authState()?.accessToken ?? null;
  }

  clearAuth(): void {
    this._authState.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private toAuthState(res: LoginResponse): AuthState {
    return {
      accessToken: res.accessToken ?? '',
      refreshToken: res.refreshToken ?? '',
      accountType: res.accountType,
      name: res.name,
      email: res.email,
      username: res.username,
    };
  }

  private suppressToast(): HttpContext {
    return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
  }

  private persist(state: AuthState): void {
    this._authState.set(state);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  private clear(): void {
    this._authState.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private loadFromStorage(): AuthState | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthState) : null;
    } catch {
      return null;
    }
  }
}
