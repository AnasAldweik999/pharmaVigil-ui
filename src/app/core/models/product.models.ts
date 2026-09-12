export interface ProductItem {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface CreateProductRequest {
  name: string;
}

export type UpdateProductRequest = CreateProductRequest;
