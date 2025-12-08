import { Task, ReferenceItem, AppConfig } from './types';

export const calculateMadeSScore = (m: number, a: number, d: number, e: number, weights: {m: number, a: number}): number => {
  // Formula: (WeightM * M + WeightA * A) × D − E
  const weightedValue = (weights.m * m) + (weights.a * a);
  const total = (weightedValue * d) - e;
  return parseFloat(total.toFixed(2));
};

export const formatScore = (score: number): string => {
  return (score || 0).toFixed(1);
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
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  
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
  { range: '2.0', label: '오늘 마감', description: '오늘 못하면 큰 손실 발생 (Critical)' },
  { range: '1.9', label: '긴급 대응', description: '서버 장애 등 즉시 해결 필요' },
  { range: '1.8', label: '내일 마감', description: '내일 오전까지 완료 필요' },
  { range: '1.7', label: '3일 내 마감', description: '이번 주 핵심 마일스톤' },
  { range: '1.6', label: '이번 주 중요', description: '금주 내 반드시 완료해야 함' },
  { range: '1.5', label: '주간 업무', description: '이번 주 통상 업무 스케줄' },
  { range: '1.4', label: '차주 마감', description: '다음 주 초까지 여유 있음' },
  { range: '1.3', label: '일정 조율 중', description: '구체적 날짜는 없으나 곧 정해짐' },
  { range: '1.2', label: '심리적 압박', description: '마감은 없지만 계속 신경 쓰임' },
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
  }
};