export type BatchStatus = 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface BatchListResponse {
  id: string;
  batchNo: string;
  productId: string;
  productName: string;
  status: BatchStatus;
  currentDepartmentId: string | null;
  currentDepartmentName: string | null;
  currentMachineId: string | null;
  currentMachineName: string | null;
  firstLoggedAt: string;
  daysSinceFirstLog: number;
  currentDepartmentEnteredAt: string;
  daysInCurrentDepartment: number;
  effectiveDepartmentHoldingTimeDays: number;
  usingExceptionalHoldingTime: boolean;
  generalHoldingAlerted: boolean;
  generalHoldingExceeded: boolean;
  departmentHoldingAlerted: boolean;
  departmentHoldingExceeded: boolean;
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

export interface BatchLogEntryResponse {
  id: string;
  departmentId: string | null;
  departmentName: string | null;
  terminalDepartment: boolean;
  machineId: string | null;
  machineName: string | null;
  productId: string;
  productName: string;
  lineClearanceAt: string;
  isRejected: boolean;
  rejectedReason: string | null;
  isCompleted: boolean;
  createdAt: string;
  createdBy: string;
  createdByFullName: string;
}

export interface BatchDetailResponse extends BatchListResponse {
  entries: BatchLogEntryResponse[];
  createdByFullName: string;
  lastUpdatedByFullName: string | null;
}

export interface CreateBatchLogEntryRequest {
  productId: string;
  departmentId: string | null;
  machineId: string | null;
  lineClearanceAt: string;
  completed: boolean;
}

export interface RejectBatchRequest {
  reason: string;
  lineClearanceAt: string;
}

export interface ReferenceItem {
  id: string;
  name: string;
  active: boolean;
}

export interface ReferenceDepartmentItem extends ReferenceItem {
  terminalDepartment: boolean;
}
