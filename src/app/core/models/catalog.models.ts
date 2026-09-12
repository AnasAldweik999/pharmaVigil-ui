export interface CatalogItem {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface CreateCatalogRequest {
  name: string;
}

export type UpdateCatalogRequest = CreateCatalogRequest;

export interface ShiftItem {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface CreateShiftRequest {
  name: string;
}

export type UpdateShiftRequest = CreateShiftRequest;
