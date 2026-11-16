export interface BusinessType {
  id: string;
  name: string;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  business_types: string[];
}

export type UnitKind = 'count' | 'mass' | 'volume' | 'length';

export interface Unit {
  id: string;
  name: string;
  plural: string;
  kind: UnitKind;
  factor: number;
  sale: boolean;
  presentation: boolean;
}

export interface License {
  id: string;
  name: string;
  url: string;
  compatible: boolean;
  share_alike: boolean;
  attribution: boolean;
}

export type SourceStatus = 'approved' | 'pending' | 'rejected';

export interface Source {
  id: string;
  name: string;
  url: string;
  license: string;
  attribution: string;
  status: SourceStatus;
  notes?: string;
}

export interface Presentation {
  quantity: number;
  unit: string;
  count?: number;
}

export interface ProductSource {
  id: string;
  ref?: string;
  retrieved_at?: string;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  unit: string;
  presentation?: Presentation;
  synonyms?: string[];
  barcodes?: string[];
  business_types: string[];
  source: ProductSource;
  license: string;
}

export interface Taxonomy {
  businessTypes: Map<string, BusinessType>;
  categories: Map<string, Category>;
  units: Map<string, Unit>;
  licenses: Map<string, License>;
  sources: Map<string, Source>;
}

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  file?: string;
  line?: number;
  id?: string;
}
