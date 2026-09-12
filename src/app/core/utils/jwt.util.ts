import { AccountType, UserRole } from '../models/role.models';

export interface AccessTokenClaims {
  email?: string;
  username?: string;
  accountType?: AccountType;
  roles?: UserRole[];
  sub?: string;
  iat?: number;
  exp?: number;
}

export function decodeAccessToken(token: string | null | undefined): AccessTokenClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function decodeAccessTokenRoles(token: string | null | undefined): UserRole[] {
  const claims = decodeAccessToken(token);
  return Array.isArray(claims?.roles) ? claims!.roles : [];
}
