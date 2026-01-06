export interface Task {
  id: string;
  title: string;
  description?: string;
  m: number; // Money
  a: number; // Asset
  d: number; // Deadline
  e: number; // Effort
  score: number;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface ReferenceItem {
  range: string;
  label: string;
  description: string;
}

export interface WeightConfig {
  m: number;
  a: number;
}

export interface RangeConfig {
  values: number[]; // Criteria에서 추출한 모든 가능한 값들
}

export interface DefaultValueConfig {
  m: number;
  a: number;
  d: number;
  e: number;
}

export interface CriteriaConfig {
  m: ReferenceItem[];
  a: ReferenceItem[];
  d: ReferenceItem[];
  e: ReferenceItem[];
}

export interface AppConfig {
  weights: WeightConfig;
  criteria: CriteriaConfig;
  ranges: {
    m: RangeConfig;
    a: RangeConfig;
    d: RangeConfig;
    e: RangeConfig;
  };
  defaultValues: DefaultValueConfig;
}

export type SortOption = 'score' | 'created';