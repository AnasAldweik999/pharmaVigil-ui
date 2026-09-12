export interface SupervisorDropdownItem {
  id: string;
  name: string;
  email: string;
  username: string;
}

export interface ExceptionalHoldingRequest {
  productId: string;
  holdingTimeDays: number;
}

export interface ExceptionalHoldingResponse {
  id: string;
  productId: string;
  holdingTimeDays: number;
}

export interface CreateDepartmentRequest {
  name: string;
  stages: string[];
  hasOutputs: boolean;
  units: string[];
  showConsignee: boolean;
  terminalDepartment: boolean;
  machineIds: string[];
  supervisorIds: string[];
  standardHoldingTime: number;
  exceptionalHoldings: ExceptionalHoldingRequest[];
}

export type UpdateDepartmentRequest = CreateDepartmentRequest;

export interface DepartmentResponse {
  id: string;
  name: string;
  active: boolean;
  stages: string[];
  hasOutputs: boolean;
  units: string[];
  showConsignee: boolean;
  terminalDepartment: boolean;
  machineIds: string[];
  supervisorIds: string[];
  standardHoldingTime: number;
  exceptionalHoldings: ExceptionalHoldingResponse[];
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface DepartmentWithBatchesResponse {
  id: string;
  name: string;
  terminalDepartment: boolean;
  standardHoldingTime: number;
}
