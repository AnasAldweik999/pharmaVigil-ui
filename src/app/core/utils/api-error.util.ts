import { HttpErrorResponse } from '@angular/common/http';

export interface ApiViolation {
  violator: string;
  violation: string;
}

export type Translate = (code: string) => string;

function isViolation(v: unknown): v is ApiViolation {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as ApiViolation).violator === 'string' &&
    typeof (v as ApiViolation).violation === 'string'
  );
}

function messageFor(v: ApiViolation, translate: Translate): string {
  return translate(v.violation);
}

export function parseViolations(err: unknown): ApiViolation[] {
  if (!(err instanceof HttpErrorResponse) || err.status !== 400) return [];
  const body = err.error;
  if (Array.isArray(body)) return body.filter(isViolation);
  if (isViolation(body)) return [body];
  return [];
}

export function extractFieldViolations(err: unknown, translate: Translate): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of parseViolations(err)) {
    if (!out[v.violator]) out[v.violator] = messageFor(v, translate);
  }
  return out;
}

export function extractErrorMessage(
  err: unknown,
  translate: Translate,
  fallbackCode = 'generic',
  translateViolator: Translate = (v) => v,
): string {
  const violations = parseViolations(err);
  if (violations.length === 1) return messageFor(violations[0], translate);
  if (violations.length > 1) {
    return violations.map((v) => `${translateViolator(v.violator)}: ${messageFor(v, translate)}`).join('\n');
  }
  if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string' && err.error.message) {
    return err.error.message;
  }
  return translate(fallbackCode);
}
