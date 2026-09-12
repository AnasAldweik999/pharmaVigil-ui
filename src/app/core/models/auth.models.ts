import { AccountType } from './role.models';

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
  portalType: AccountType;
}

export interface LoginResponse {
  accessToken: string | null;
  refreshToken: string | null;
  accountType: AccountType;
  expiresIn: number;
  name: string;
  email: string;
  username: string | null;
  requiresUsernameSetup: boolean;
  setupToken: string | null;
}

export interface SetupUsernameRequest {
  setupToken: string;
  username: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AuthState {
  accessToken: string;
  refreshToken: string;
  accountType: AccountType;
  name: string;
  email: string;
  username: string | null;
}
