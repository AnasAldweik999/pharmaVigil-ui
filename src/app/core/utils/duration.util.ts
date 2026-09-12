const DURATION_PATTERN = /^(\d+):([0-5]\d)$/;

export function buildDuration(hours: number, minutes: number): string {
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export function durationTotalMinutes(hours: number | null, minutes: number | null): number {
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function parseDuration(hhmm: string): { hours: number; minutes: number } {
  const match = DURATION_PATTERN.exec(hhmm);
  if (!match) return { hours: 0, minutes: 0 };
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}
