export interface Task {
  id: string;
  title: string;
  description?: string;
  m: number; // Money (1-10)
  a: number; // Asset (1-10)
  d: number; // Deadline (1.0-2.0)
  e: number; // Effort (1-5)
  score: number;
  completed: boolean;
  createdAt: number;
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

export interface CriteriaConfig {
  m: ReferenceItem[];
  a: ReferenceItem[];
  d: ReferenceItem[];
  e: ReferenceItem[];
}

export interface AppConfig {
  weights: WeightConfig;
  criteria: CriteriaConfig;
}

export type SortOption = 'score' | 'created';