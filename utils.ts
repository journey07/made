import { Task, ReferenceItem, AppConfig } from './types';

// D값 동적 계산을 위한 매핑 테이블
export const DEADLINE_D_MAPPING: { maxDays: number; d: number; label: string }[] = [
  { maxDays: -1, d: 3.0, label: '마감 지남' },      // 이미 지남
  { maxDays: 0, d: 2.7, label: '오늘 마감' },       // 오늘
  { maxDays: 1, d: 2.3, label: '내일 마감' },       // 내일
  { maxDays: 2, d: 2.0, label: '2일 내 마감' },     // 2일
  { maxDays: 3, d: 1.8, label: '3일 내 마감' },     // 3일
  { maxDays: 7, d: 1.6, label: '이번 주 마감' },    // 4-7일
  { maxDays: 14, d: 1.4, label: '차주 마감' },      // 8-14일
  { maxDays: Infinity, d: 1.2, label: '2주 이상 여유' }, // 15일+
];

// deadline(ISO string)에서 D값 계산
export const calculateDFromDeadline = (deadline: string): { d: number; label: string; daysLeft: number } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 명시적으로 로컬 타임존으로 파싱 (타임존 버그 방지)
  const [year, month, day] = deadline.split('-').map(Number);
  const deadlineDate = new Date(year, month - 1, day); // month is 0-indexed

  const diffTime = deadlineDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 매핑 테이블에서 해당하는 값 찾기
  for (const mapping of DEADLINE_D_MAPPING) {
    if (daysLeft <= mapping.maxDays) {
      return { d: mapping.d, label: mapping.label, daysLeft };
    }
  }

  // fallback (shouldn't reach here)
  return { d: 1.2, label: '여유 있음', daysLeft };
};

// Task의 effective D값 가져오기 (deadline 있으면 동적 계산, 없으면 수동 값)
export const getEffectiveD = (task: Task): number => {
  // 완료된 task는 저장된 D값 그대로 사용
  if (task.completed) {
    return task.d;
  }

  // deadline이 있으면 동적으로 D값 계산
  if (task.deadline) {
    const { d } = calculateDFromDeadline(task.deadline);
    return d;
  }

  // deadline 없으면 수동 설정된 d값 사용
  return task.d;
};

// D-day 라벨 생성 (예: "D-3", "D-Day", "D+2")
export const getDdayLabel = (deadline: string): string => {
  const { daysLeft } = calculateDFromDeadline(deadline);

  if (daysLeft < 0) return `D+${Math.abs(daysLeft)}`;
  if (daysLeft === 0) return 'D-Day';
  return `D-${daysLeft}`;
};

export const calculateMadeSScore = (m: number, a: number, d: number, e: number, weights: {m: number, a: number}): number => {
  // Formula: ((WeightM * M + WeightA * A) × D − E) × 10
  const weightedValue = (weights.m * m) + (weights.a * a);
  const total = ((weightedValue * d) - e) * 10;
  return parseFloat(total.toFixed(2));
};

export const formatScore = (score: number): string => {
  return (score || 0).toFixed(1);
};

// Criteria에서 자동으로 가능한 값들 추출
export const extractValuesFromCriteria = (criteria: ReferenceItem[]): number[] => {
  if (!criteria || criteria.length === 0) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }

  const allValues = new Set<number>();
  
  criteria.forEach(item => {
    const parts = item.range.split(/[-~]/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    
    if (parts.length === 2) {
      // Range: 모든 정수/소수 값 생성
      const [start, end] = parts;
      const isDecimal = start % 1 !== 0 || end % 1 !== 0;
      const step = isDecimal ? 0.1 : 1;
      
      for (let v = start; v <= end; v = parseFloat((v + step).toFixed(1))) {
        allValues.add(v);
      }
    } else if (parts.length === 1) {
      // 단일 값
      allValues.add(parts[0]);
    }
  });

  return Array.from(allValues).sort((a, b) => a - b);
};

// Helper to find the matching criteria item
const findCriteriaItem = (val: number, criteria: ReferenceItem[]) => {
  if (!criteria) return null;
  return criteria.find((c) => {
    // Handle "1.1-1.2" or "9-10" or "2.0" or "1"
    const parts = c.range.split(/[-~]/).map(p => parseFloat(p.trim()));
    
    if (parts.length === 2) {
      // Range check (inclusive)
      return val >= parts[0] && val <= parts[1];
    } else if (parts.length === 1) {
      // Exact match with small epsilon for floats
      return Math.abs(val - parts[0]) < 0.05;
    }
    return false;
  });
};

export const getDescription = (val: number, criteria: ReferenceItem[]) => {
  const found = findCriteriaItem(val, criteria);
  return found?.description || "";
};

export const getLabel = (val: number, criteria: ReferenceItem[]) => {
  const found = findCriteriaItem(val, criteria);
  return found?.label || "";
};

export const getRelativeDateLabel = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  
  // Reset times to compare dates only
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = n.getTime() - d.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  
  // 그 외의 경우 완료한 날짜 자체를 표기
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Default Reference Data
export const DEFAULT_M_CRITERIA: ReferenceItem[] = [
  { range: '10', label: '시장 독점', description: '시장 독점적 매출 기회, 초대형 계약 달성' },
  { range: '9', label: '핵심 매출', description: '회사의 핵심 캐시카우가 되는 메인 프로젝트' },
  { range: '8', label: '신규 계약', description: '매출이 확정된 신규 대형 계약' },
  { range: '7', label: '매출 직결', description: '당장 입금으로 이어지는 마무리 단계' },
  { range: '6', label: '재계약/확장', description: '기존 고객 재계약 확정 및 범위 확장' },
  { range: '5', label: '업셀 기회', description: '기존 고객에게 추가 기능을 제안하여 매출 증대' },
  { range: '4', label: '유력 파이프라인', description: '계약 성사 가능성이 높은 영업 활동' },
  { range: '3', label: '잠재 고객', description: '콜드 메일, 초기 미팅 등 리드 확보' },
  { range: '2', label: '브랜딩/마케팅', description: '장기적 매출을 위한 인지도 제고 활동' },
  { range: '1', label: '단순 유지보수', description: '매출 기여도 낮은 단순 수정 및 CS' },
];

export const DEFAULT_A_CRITERIA: ReferenceItem[] = [
  { range: '10', label: 'AI/자동화', description: '완전 자동화 시스템 구축, AI 모델 통합' },
  { range: '9', label: '핵심 엔진', description: '다른 프로젝트에도 쓰일 코어 엔진 개발' },
  { range: '8', label: '독점 기술', description: '경쟁사가 모방하기 힘든 독자 기술 확보' },
  { range: '7', label: '시스템화', description: '업무 시간을 획기적으로 줄여주는 템플릿/툴' },
  { range: '6', label: '지식 자산', description: '팀 전체가 공유 가능한 고유 노하우/매뉴얼' },
  { range: '5', label: '프로세스 최적화', description: '반복 업무 효율화를 위한 워크플로우 개선' },
  { range: '4', label: '재사용 모듈', description: '향후 재사용 가능한 코드 블록/디자인' },
  { range: '3', label: '교육/전파', description: '팀원 교육 또는 외부 발표 자료 제작' },
  { range: '2', label: '단순 구현', description: '특정 프로젝트에만 종속된 기능 구현' },
  { range: '1', label: '휘발성', description: '일회성 작업, 자산 가치가 남지 않음' },
];

export const DEFAULT_D_CRITERIA: ReferenceItem[] = [
  // 자동 계산용 (deadline 설정 시)
  { range: '3.0', label: '마감 지남', description: '이미 마감일이 지난 긴급 업무' },
  { range: '2.7', label: '오늘 마감', description: '오늘 내로 반드시 완료 (Critical)' },
  { range: '2.3', label: '내일 마감', description: '내일까지 완료 필요' },
  { range: '2.0', label: '2일 내', description: '2일 내 완료 필요' },
  { range: '1.8', label: '3일 내', description: '3일 내 완료 필요' },
  { range: '1.6', label: '이번 주', description: '이번 주 내 완료 (4-7일)' },
  { range: '1.4', label: '차주', description: '다음 주까지 여유 (8-14일)' },
  { range: '1.2', label: '2주 이상', description: '15일 이상 여유 있음' },
  // 수동 설정용 (deadline 미설정 시)
  { range: '1.5', label: '주간 업무', description: '이번 주 통상 업무 스케줄' },
  { range: '1.3', label: '일정 조율 중', description: '구체적 날짜는 없으나 곧 정해짐' },
  { range: '1.1', label: '구상 단계', description: '아이디어 정리 및 기획 초기' },
  { range: '1.0', label: '무기한', description: '언제 해도 상관없는 장기 과제' },
];

export const DEFAULT_E_CRITERIA: ReferenceItem[] = [
  { range: '1', label: '매우 쉬움', description: '20분 컷. 뇌를 안 쓰고 기계적으로 처리 가능.' },
  { range: '2', label: '쉬움', description: '1시간 이내. 익숙한 업무라 수월하게 진행.' },
  { range: '3', label: '보통', description: '반나절 소요. 약간의 고민과 문제 해결 필요.' },
  { range: '4', label: '어려움', description: '높은 집중력 필요. 복잡한 로직 설계나 깊은 사고.' },
  { range: '5', label: '매우 어려움', description: '하루 종일 풀가동. 처음 해보는 난제 해결.' },
];

export const DEFAULT_CONFIG: AppConfig = {
  weights: { m: 0.8, a: 1.2 },
  criteria: {
    m: DEFAULT_M_CRITERIA,
    a: DEFAULT_A_CRITERIA,
    d: DEFAULT_D_CRITERIA,
    e: DEFAULT_E_CRITERIA,
  },
  ranges: {
    m: { values: extractValuesFromCriteria(DEFAULT_M_CRITERIA) },
    a: { values: extractValuesFromCriteria(DEFAULT_A_CRITERIA) },
    d: { values: extractValuesFromCriteria(DEFAULT_D_CRITERIA) },
    e: { values: extractValuesFromCriteria(DEFAULT_E_CRITERIA) },
  },
  defaultValues: {
    m: 5,
    a: 4,
    d: 1.5,
    e: 3,
  },
};