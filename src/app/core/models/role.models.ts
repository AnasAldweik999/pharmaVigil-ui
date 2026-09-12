export type AccountType = 'SUPERVISOR' | 'STAFF';

export type UserRole =
  | 'DASHBOARD_VIEWER'
  | 'REPORTS_MANAGER'
  | 'MACHINE_MANAGER'
  | 'STOP_TYPES_MANAGER'
  | 'USERS_MANAGER'
  | 'SHIFT_MANAGER'
  | 'FIELD_REPORTER'
  | 'PRODUCTS_MANAGER'
  | 'DEPARTMENTS_MANAGER'
  | 'BATCH_LOG_REPORTER'
  | 'BATCH_TRACKING_MANAGER';

export interface RoleOption {
  key: UserRole;
  name: string;
  description: string;
  accountType: AccountType;
}
