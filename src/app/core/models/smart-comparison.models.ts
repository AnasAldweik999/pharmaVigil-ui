export type SmartGroupBy = 'MACHINE' | 'STAFF' | 'SHIFT' | 'DATE' | 'STOP';

export interface SmartComparisonFilters {
  groupBy: SmartGroupBy;
  startDate: string;
  endDate: string;
  shiftIds?: string[];
  staffIds?: string[];
  machineIds?: string[];
}

export interface SummaryCardsData {
  totalProducts: number;
  totalStops: number;
  totalDowntimeMinutes: string;
  totalHolds: number;
  totalDeviations: number;
  totalMachines: number;
}

export interface SmartSummaryResponse {
  summaryCards: SummaryCardsData;
  groupedDataLink: string;
}

export interface BaseGroupRow {
  productCount: number;
  stopCount: number;
  downtimeMinutes: string;
  holdCount: number;
  deviationCount: number;
  _links: Record<string, string>;
}

export interface MachineGroupRow extends BaseGroupRow { machineName: string; departmentName: string; }
export interface StaffGroupRow   extends BaseGroupRow { staffName: string; staffUsername: string; staffEmail: string; }
export interface ShiftGroupRow   extends BaseGroupRow { shiftName: string; }
export interface DateGroupRow    extends BaseGroupRow { date: string; }

export interface StopGroupRow {
  stopName: string;
  totalMachines: number;
  totalProducts: number;
  totalDowntimeMinutes: string;
  _links: Record<string, string>;
}

export interface StopMachineRow {
  machineName: string;
  machineStatus: string;
  departmentName: string;
  staffName: string;
  staffUsername: string;
  staffEmail: string;
  shift: string;
  workingDate: string;
  totalProducts: number;
  totalDowntimeMinutes: string;
  _links: Record<string, string>;
}

export interface StopProductRow {
  productName: string;
  batchNo: string;
  consignee: string | null;
  completedStages: string | null;
}

export type AnyGroupRow = MachineGroupRow | StaffGroupRow | ShiftGroupRow | DateGroupRow | StopGroupRow;

export interface ScPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ProductStopRow {
  stopTypeName: string;
  duration: string;
  note: string | null;
}
