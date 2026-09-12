export type MachineStatus = 'RUNNING' | 'STOPPED' | 'MAINTENANCE' | 'READY';

export interface ShiftRef    { id: string; name: string; }
export interface MachineRef  { id: string; name: string; }
export interface StopTypeRef { id: string; name: string; }

export interface CreateWorkReportRequest {
  reportDate: string;
  shiftId:    string;
  machines:   MachineEntryRequest[];
}
export interface MachineEntryRequest {
  machineId:    string;
  departmentId: string;
  status:       MachineStatus;
  products:     ProductEntryRequest[];
}
export interface ProductEntryRequest {
  productId:  string;
  batchNo:    string;
  output:     number;
  unit:       string | null;
  consignee:  string | null;
  stages:     Record<string, boolean>;
  stops:      StopRequest[];
  quality:    QualityRequest;
}
export interface StopRequest {
  stopTypeId: string;
  duration:   string;
  note:       string | null;
}
export interface QualityRequest {
  deviation:        boolean;
  deviationDetails: string | null;
  hold:             boolean;
  holdDetails:      string | null;
}

export interface WorkReportResponse {
  id:            string;
  staffId:       string;
  staffName:     string;
  staffUsername: string;
  staffEmail:    string;
  shiftId:       string;
  shiftName:     string;
  reportDate:    string;
  createdAt:     string;
  updatedAt:     string;
  machines:      MachineEntryResponse[];
}
export interface MachineEntryResponse {
  id:             string;
  machineId:      string;
  machineName:    string;
  departmentId:   string;
  departmentName: string;
  status:         MachineStatus;
  products:       ProductEntryResponse[];
}
export interface ProductEntryResponse {
  id:          string;
  productId:   string;
  productName: string;
  batchNo:     string;
  output:      number;
  unit:        string | null;
  consignee:   string | null;
  stages:      Record<string, boolean>;
  stops:       StopResponse[];
  quality:     QualityResponse;
}
export interface StopResponse {
  id:           string;
  stopTypeId:   string;
  stopTypeName: string;
  duration:     string;
  note:         string | null;
}
export interface QualityResponse {
  deviation:        boolean;
  deviationDetails: string | null;
  hold:             boolean;
  holdDetails:      string | null;
}
