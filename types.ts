export interface Task {
  id: string;
  title: string;
  description?: string;
  m: number; // Money
  a: number; // Asset
  d: number; // Deadline (calculated or manual)
  e: number; // Effort
  score: number;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  deadline?: string;    // ISO date string (선택) - 있으면 D값 자동 계산
  originalD?: number;   // deadline 없을 때 수동 D값 보존용
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