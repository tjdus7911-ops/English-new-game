/** 저택 리모델링 게임 — 도메인 타입 (UI·저장소 무관). 기획서 v1.1 데이터 모델을 기존 앱 구조에 맞춘 것 */
import type { Question } from '../types';

export type LearningArea = 'vocabulary' | 'grammar' | 'reading' | 'exam';
export type StageStatus = 'locked' | 'available' | 'in_progress' | 'cleared';
export type TaskStatus = 'locked' | 'available' | 'completed';
export type TaskKind = 'cleanup' | 'repair' | 'furniture' | 'finish';
export type TaskPhase = 'clean' | 'repair' | 'furniture' | 'lighting' | 'decor';

export interface StageDef {
  id: string;
  area: LearningArea;
  order: number;
  title: string;
  subtitle: string;
  cefr: 'A1' | 'A2' | 'B1' | 'B2';
  questions: Question[]; // 정확히 5문항 — 정답은 문항 id 에 매핑된 answers
  passingScore: number;
  rewardStars: number;
  prerequisites: string[];
  /** 동화·독해 본문 (reading 영역) */
  passage?: { title: string; paragraphs: { en: string; ko: string }[] };
  /** 콘텐츠 출처·라이선스 */
  source: string;
}

export interface StageProgress {
  stageId: string;
  /** 진행 기록상의 상태. locked/available 은 선행 조건으로 계산한다 */
  status: 'in_progress' | 'cleared';
  bestScore: number;
  lastScore: number;
  attempts: number;
  firstClearedAt?: string;
}

export interface FurnitureVariant {
  id: string;
  assetKey: string;
  label: string;
  /** 세트형 선택지: 함께 바뀌는 다른 슬롯 (예: 소파 세트의 안락의자) slot → assetKey */
  extras?: Record<string, string>;
}

export interface RenovationTask {
  id: string;
  roomId: 'living';
  order: number;
  title: string;
  desc: string;
  costStars: number;
  kind: TaskKind;
  prerequisiteTaskIds: string[];
  /** 렌더 슬롯 (game/mansion/mapData.ts) */
  slot: string;
  variants?: FurnitureVariant[];
  /** 진행 전에 끝나 있어야 하는 스토리 이벤트 */
  requiresEvents?: string[];
  /** 교체 전 낡은 오브젝트 에셋 (교체형) */
  oldAssetKey?: string;
  /** 작업 연출: 캐릭터 작업 위치(그리드)·방향·동작·연출 종류 */
  work: { spot: [number, number]; facing: 'left' | 'right'; action: 'sweep' | 'paint' | 'repair'; anim: 'clean' | 'paint' | 'repair' | 'install' | 'finish' };
  /** 리모델링 단계 (청소 → 수리 → 가구 → 조명·패브릭 → 소품) */
  phase: TaskPhase;
  /** 화면 속 연결 오브젝트 (content/mansion/objects.ts) */
  objectId?: string;
  /** false = 디자인 에셋 준비 중 → 목록에는 보이지만 진행 불가 (화면 변화 없는 미션을 만들지 않기 위함) */
  ready?: boolean;
  /** 준비 중일 때 필요한 에셋 설명 */
  assetNote?: string;
}

export interface RenovationProgress {
  taskId: string;
  status: 'completed';
  selectedVariantId?: string;
  completedAt: string;
  /** 마이그레이션으로 보존한 이전 선택 (slot → assetKey). variant.extras 보다 우선 */
  keep?: Record<string, string>;
  /** 이전 미션 구조에서 넘어온 완료 (별을 다시 요구하지 않음) */
  migratedFrom?: string;
}

export interface LedgerEntry {
  id: string;
  idempotencyKey: string;
  type: 'earn' | 'spend';
  amount: number; // 항상 양수
  sourceId: string;
  createdAt: string;
}

export interface StoryState {
  completedEvents: string[];
  /** 진행 중이던 이벤트 — 앱 재시작 시 처음부터 다시 재생 (효과는 멱등) */
  currentEventId: string | null;
  clues: Record<string, { foundAt: string; eventId: string }>;
  quizzes: Record<string, { solved: boolean; attempts: number; solvedAt?: string }>;
}

export interface MansionState {
  stages: Record<string, StageProgress>;
  renovations: Record<string, RenovationProgress>;
  ledger: LedgerEntry[];
  /** 이미 처리한 학습 시도 id — 결과 화면 더블 탭·재전송 시 중복 기록 방지 */
  processedAttempts: string[];
  storySeen: string[];
  story: StoryState;
  /** v5 이전 미션(R01~R10) 진행 기록 원본 — 삭제하지 않고 보관 */
  legacyRenovations?: Record<string, RenovationProgress>;
  /** 새 미션 구조에 대응 작업이 없는 이전 선택(장식장 등) slot → assetKey. 계속 렌더한다 */
  legacyKeep?: Record<string, string>;
}

export const initialStoryState = (): StoryState => ({ completedEvents: [], currentEventId: null, clues: {}, quizzes: {} });
export const initialMansionState = (): MansionState => ({ stages: {}, renovations: {}, ledger: [], processedAttempts: [], storySeen: [], story: initialStoryState() });
