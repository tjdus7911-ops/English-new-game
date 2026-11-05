/**
 * 별 보상·오늘의 퀘스트 설정 — 밸런스 조정은 이 파일만 수정합니다.
 * 원칙: 학습 세트 1개 = 별 1개, 같은 세트는 최초 1회만. 반복 학습은 언제든 가능하지만 기록만 갱신합니다.
 */
export type SetType = 'vocab-beginner' | 'vocab-intermediate' | 'vocab-advanced' | 'grammar' | 'writing' | 'listening' | 'speaking' | 'story';
export type ActivityArea = 'vocab' | 'grammar' | 'writing' | 'listening' | 'speaking' | 'story';

export const REWARD_POLICY = {
  /** 이 정답률 이상이면 완료 즉시 별 지급 */
  passAccuracy: 0.6,
  /** 정답률 미만이면 '오답 해설 확인 + 틀린 문제 복습(다시 맞히기)' 완료 후 지급 */
  belowPassRequiresReview: true,
  starsPerSet: 1,
  /** 문제가 표시된 직후 이 시간 동안은 답을 받지 않음 — 화면을 보지 않고 연타하는 입력 방지 (빠르게 푸는 것 자체는 제한하지 않음) */
  answerLockMs: 350,
} as const;

/** 세트당 문제 수(= 별 1개 조건) */
export const SET_SIZE: Record<SetType, number> = {
  'vocab-beginner': 10,
  'vocab-intermediate': 8,
  'vocab-advanced': 5,
  grammar: 5,
  writing: 3,
  listening: 5,
  speaking: 5,
  story: 3, // 짧은 이야기 1편 + 독해 3문제
};

export const SET_AREA: Record<SetType, ActivityArea> = {
  'vocab-beginner': 'vocab', 'vocab-intermediate': 'vocab', 'vocab-advanced': 'vocab',
  grammar: 'grammar', writing: 'writing', listening: 'listening', speaking: 'speaking', story: 'story',
};

export interface DailyQuestDef { id: string; title: string; desc: string; area: ActivityArea; target: number; link: string; requires?: 'audio' | 'mic'; fallback?: Omit<DailyQuestDef, 'fallback' | 'requires'> }

/** 오늘의 영어 퀘스트 (매일 초기화). 음성 재생이 불가능한 환경이면 fallback 으로 대체 */
export const DAILY_QUESTS: DailyQuestDef[] = [
  { id: 'q-vocab', title: '영단어 10개 학습', desc: '영단어 세트에서 10문제 풀기', area: 'vocab', target: 10, link: '/learn/vocab' },
  { id: 'q-grammar', title: '문법 5문제 학습', desc: '문법 단원 연습 1세트', area: 'grammar', target: 5, link: '/learn/grammar' },
  {
    id: 'q-listening', title: '리스닝 5문제 학습', desc: '대화 듣기 1세트', area: 'listening', target: 5, link: '/listening', requires: 'audio',
    fallback: { id: 'q-story', title: '동화 독해 3문제', desc: '동화책 1편 읽고 독해 퀴즈', area: 'story', target: 3, link: '/learn/library' },
  },
];
export const DAILY_BONUS_STARS = 1;
