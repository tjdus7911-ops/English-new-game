/**
 * 저장 데이터 구조 — EGG ISLAND 전용 저장소 (다른 앱과 키·DB 를 공유하지 않는다).
 * 저장소: IndexedDB 'egg-island' / 키 'save-v1'. 버전 필드로 마이그레이션.
 * 진화해도 uid·획득일·기록은 그대로 유지되고 stage 만 바뀐다.
 */
import type { AttributeId, StageNo } from './species';

export const SAVE_DB = 'egg-island';
export const SAVE_KEY = 'save-v1';
export const SAVE_VERSION = 1;

export interface Egg { uid: string; attribute: AttributeId; obtainedAt: number; source: string; hatchReadyAt: number }

export interface PetHistory { at: number; type: 'hatch' | 'level' | 'evolve' | 'rename'; detail?: string }

export interface OwnedPet {
  uid: string;              // 진화 전후 동일
  speciesId: string;        // PET_FIRE_A …
  nickname?: string;
  stage: StageNo;
  level: number;
  exp: number;
  intimacy: number;         // 0..CONFIG.intimacyMax
  fullness: number;         // 0..100
  energy: number;           // 0..100
  acquiredAt: number;
  history: PetHistory[];
  /** 날짜(YYYY-MM-DD)별 상호작용 횟수 — 하루 상한 계산 */
  daily: Record<string, { feed?: number; pet?: number; play?: number }>;
  lastTickAt: number;
}

export interface DexEntry { firstSeenAt: number; ownedCount: number; maxStage: StageNo }

export interface SaveData {
  version: number;
  createdAt: number;
  coins: number;
  food: number;
  eggs: Egg[];
  pets: Record<string, OwnedPet>;
  /** 화면에 나와 있는 펫 uid (최대 CONFIG.maxActivePets) */
  active: string[];
  dex: Record<string, DexEntry>;
  settings: { sound: boolean; reduceMotion: boolean };
}
