import { DOCUMENT } from '@angular/common';
import { Injectable, REQUEST, computed, inject, signal } from '@angular/core';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';

export type Locale = 'en' | 'ar';

type Dictionary = typeof en;

const LOCALE_COOKIE = 'pv-locale';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });

  private readonly dictionaries: Record<Locale, Dictionary> = { en, ar };

  readonly locale = signal<Locale>(this.detectInitialLocale());
  readonly dir = computed(() => (this.locale() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    this.applyToDocument(this.locale());
  }

  t(key: string, params?: Record<string, string>): string {
    const dict = this.dictionaries[this.locale()];
    const raw = dict[key as keyof Dictionary];
    if (raw === undefined) return key;
    if (!params) return raw;
    return Object.entries(params).reduce(
      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, value),
      raw,
    );
  }

  errorMessage(code: string): string {
    const translated = this.t(code);
    return translated !== code ? translated : code.replace(/\./g, ' ');
  }

  violatorLabel(violator: string): string {
    const translated = this.t(violator);
    return translated !== violator ? translated : violator;
  }

  setLocale(locale: Locale): void {
    if (locale === this.locale()) return;
    this.writeCookie(locale);
    // Force a full reload rather than switching in place: the server then
    // re-renders from scratch with the new cookie already set (same
    // zero-flash path as a normal page load), which also guarantees
    // consistency for things that only read the locale once at
    // initialization (e.g. flatpickr's calendar locale) instead of relying
    // on every consumer reacting correctly in place.
    this.document.defaultView?.location.reload();
  }

  private detectInitialLocale(): Locale {
    const fromCookie = this.readCookie(LOCALE_COOKIE);
    if (fromCookie === 'en' || fromCookie === 'ar') return fromCookie;

    const acceptLanguage = this.request?.headers.get('accept-language') ?? '';
    return acceptLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  private readCookie(name: string): string | null {
    const raw = this.request
      ? (this.request.headers.get('cookie') ?? '')
      : this.document.cookie;

    for (const part of raw.split(';')) {
      const [key, ...rest] = part.trim().split('=');
      if (key === name) return decodeURIComponent(rest.join('='));
    }
    return null;
  }

  private writeCookie(locale: Locale): void {
    if (this.request) return; // no live response to attach a Set-Cookie to from a server-side write
    this.document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }

  private applyToDocument(locale: Locale): void {
    this.document.documentElement.lang = locale;
    this.document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }
}
