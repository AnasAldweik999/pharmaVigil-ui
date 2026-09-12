import { TranslationService } from '../services/translation.service';

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

// Deliberately coarse (minute/hour/day/older) rather than a full i18n duration
// library — this only ever labels a notification's arrival time, so a rough
// relative sense ("5m ago", "yesterday") is all that's needed.
export function formatRelativeTime(iso: string, translation: TranslationService): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSeconds < MINUTE) return translation.t('notifications.justNow');
  if (diffSeconds < HOUR) return translation.t('notifications.minutesAgo', { count: String(Math.floor(diffSeconds / MINUTE)) });
  if (diffSeconds < DAY) return translation.t('notifications.hoursAgo', { count: String(Math.floor(diffSeconds / HOUR)) });

  const days = Math.floor(diffSeconds / DAY);
  if (days === 1) return translation.t('notifications.yesterday');
  if (days < 7) return translation.t('notifications.daysAgo', { count: String(days) });

  const date = new Date(iso);
  const locale = translation.locale() === 'ar' ? 'ar' : 'en-GB';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(locale, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}
