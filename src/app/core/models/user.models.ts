import { AccountType, UserRole } from './role.models';

export type { AccountType, UserRole } from './role.models';

export type UserStatus = 'PENDING_EMAIL_VERIFICATION' | 'ACTIVE' | 'INACTIVE';

export interface CreateUserRequest {
  name: string;
  email: string;
  username: string;
  roles: UserRole[];
}

export interface UpdateUserRequest {
  name: string;
  email: string;
  username: string;
  roles: UserRole[];
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  accountType: AccountType;
  roles: UserRole[];
  status: UserStatus;
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface UserFieldAvailabilityResponse {
  available: boolean;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
