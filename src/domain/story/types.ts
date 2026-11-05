/** 스토리·영어 추리 — 데이터 타입. 대사·이벤트는 content/story/* 데이터로만 관리한다(컴포넌트 하드코딩 금지). */
import type { Grid } from '@/game/mansion/iso';

export type CharacterId = 'haru' | 'aubrey' | 'hodu';
export type Expression = 'normal' | 'happy' | 'surprised' | 'suspicious' | 'worried' | 'thinking' | 'curious';
export type CharAction = 'idle' | 'walk' | 'sweep' | 'paint' | 'repair' | 'celebrate' | 'sniff';

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  role: string;
  look: string;
  personality: string;
  speech: string;
  /** 스프라이트 시트·초상 에셋 키 */
  sprite: string;
  portrait: string;
  expressions: Expression[];
  actions: CharAction[];
  /** 월드 표시 너비(px) */
  width: number;
  color: string;
}

export type StoryStep =
  | { t: 'say'; who: CharacterId; expr?: Expression; text: string }
  | { t: 'narrate'; text: string }
  | { t: 'move'; who: CharacterId; to: string; wait?: boolean }
  | { t: 'face'; who: CharacterId; dir: 'left' | 'right' }
  | { t: 'act'; who: CharacterId; action: CharAction; ms: number; wait?: boolean }
  | { t: 'camera'; focus: string; zoom?: number; ms?: number }
  | { t: 'cameraReset' }
  | { t: 'shake'; target: string }
  | { t: 'reveal'; prop: string; at: Grid; h?: number; width: number; assetKey: string }
  | { t: 'hideProp'; prop: string }
  | { t: 'fx'; kind: 'sparkle' | 'dust' | 'get'; at: Grid; h?: number }
  | { t: 'clue'; id: string }
  | { t: 'quiz'; id: string }
  | { t: 'wait'; ms: number }
  | { t: 'place'; who: CharacterId; at: string };

export type StoryTrigger =
  | { type: 'enterMansion' }
  | { type: 'taskCompleted'; taskId: string }
  /** 여러 작업을 모두 끝냈을 때 (예: 거실 40개 완성) */
  | { type: 'allTasksCompleted'; taskIds: string[] }
  | { type: 'interact'; objectId: string };

export interface StoryEvent {
  id: string;
  chapter: string;
  title: string;
  trigger: StoryTrigger;
  requires?: string[];
  steps: StoryStep[];
}

export interface Chapter {
  id: string;
  order: number;
  title: string;
  place: string;
  summary: string;
  /** 실제 플레이 가능한 콘텐츠인지 (false = 준비 중, 플레이 불가 표시) */
  available: boolean;
  unlock: { eventsDone: string[] };
  roomId?: string;
}

export interface Clue {
  id: string;
  name: string;
  desc: string;
  chapter: string;
  taskId: string | null;
  sentence: string;
  translation: string;
  learning: string[];
  eventId: string;
  assetKey: string;
}

export interface StoryQuiz {
  id: string;
  type: 'choice' | 'order';
  cefr: 'A1' | 'A2' | 'B1';
  /** 단서에 적힌 영어 원문 */
  source: string;
  sourceLabel: string;
  prompt: string;
  choices?: string[];
  tokens?: string[];
  answer: string;
  /** 오답 시 단계별 힌트: 단어 뜻 → (반복 오답 시) 전체 해석 */
  glosses: { en: string; ko: string }[];
  translation: string;
  explanation: string;
}
