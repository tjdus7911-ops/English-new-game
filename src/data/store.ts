/**
 * 게임 진행 데이터 — 코인·알·보유 펫·장식. 브라우저 localStorage 에 저장(막혀 있으면 메모리만).
 * - 알은 시간이 흘러서가 아니라 '영어 학습으로 쌓인 유효 학습 시간'으로만 부화한다.
 * - 보유 펫은 시안용 기본 펫으로 시작하고, 부화하면 늘어난다.
 */
import { useSyncExternalStore } from 'react';
import { CONFIG } from './config';
import { DEMO_PETS, PLAYER } from './mock';
import { SPECIES_BY_ATTR, type AttributeId, type StageNo } from './species';

export interface Egg { uid: string; attr: AttributeId; studyMin: number; needMin: number; source: 'first' | 'shop'; at: number }
export interface GamePet { uid: string; speciesId: string; stage: StageNo; level: number; hearts: number; deco: string | null }
export interface GameState { v: 2; coins: number; firstEggClaimed: boolean; eggs: Egg[]; pets: GamePet[]; studySessions: number }

const KEY = 'egg-island-save-v2';
const initial = (): GameState => ({
  v: 2, coins: PLAYER.coins, firstEggClaimed: false, eggs: [], studySessions: 0,
  pets: DEMO_PETS.map((p) => ({ uid: p.uid, speciesId: p.speciesId, stage: p.stage, level: p.level, hearts: p.hearts, deco: null })),
});

function load(): GameState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as GameState; if (s.v === 2) return s; }
  } catch { /* 저장소 사용 불가 — 메모리만 */ }
  return initial();
}

let state: GameState = load();
const subs = new Set<() => void>();
function set(next: GameState) {
  state = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 무시 */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useGame = (): GameState => useSyncExternalStore(subscribe, () => state);
export const getGame = () => state;

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const isReady = (e: Egg) => e.studyMin >= e.needMin;

/** 첫 알(튜토리얼, 무료) 받기 — 이미 받았다면 기존 알의 uid 를 돌려준다 */
export function claimFirstEgg(attr: AttributeId): string {
  const old = state.eggs.find((e) => e.source === 'first');
  if (state.firstEggClaimed && old) return old.uid;
  const egg: Egg = { uid: uid('e'), attr, studyMin: 0, needMin: CONFIG.hatchStudyMin.first, source: 'first', at: Date.now() };
  set({ ...state, firstEggClaimed: true, eggs: [...state.eggs, egg] });
  return egg.uid;
}

/** 알 분양소 구매 — 코인 차감 후 알을 소유 데이터에 등록(즉시 부화하지 않음) */
export function buyEgg(attr: AttributeId): { ok: true; uid: string } | { ok: false; reason: 'coins' } {
  const price = CONFIG.eggPrice[attr];
  if (state.coins < price) return { ok: false, reason: 'coins' };
  const egg: Egg = { uid: uid('e'), attr, studyMin: 0, needMin: CONFIG.hatchStudyMin.shop, source: 'shop', at: Date.now() };
  set({ ...state, coins: state.coins - price, eggs: [...state.eggs, egg] });
  return { ok: true, uid: egg.uid };
}

export function addCoins(n: number) { set({ ...state, coins: state.coins + n }); }

/** 영어 학습 1회 완료 → 아직 부화 조건이 안 찬 가장 오래된 알에 유효 학습 시간 적립 */
export function addStudy(minutes: number): { eggUid: string | null; added: number } {
  const target = state.eggs.find((e) => !isReady(e));
  set({
    ...state, studySessions: state.studySessions + 1,
    eggs: state.eggs.map((e) => (e === target ? { ...e, studyMin: Math.min(e.needMin, e.studyMin + minutes) } : e)),
  });
  return { eggUid: target?.uid ?? null, added: target ? Math.min(minutes, target.needMin - target.studyMin) : 0 };
}

/** 부화 가능한 알을 부화시켜 그 속성 3종 중 하나를 가중치대로 뽑는다 */
export function hatchEgg(eggUid: string): GamePet | null {
  const egg = state.eggs.find((e) => e.uid === eggUid);
  if (!egg || !isReady(egg)) return null;
  const list = SPECIES_BY_ATTR(egg.attr);
  const w = CONFIG.hatchWeights[egg.attr];
  const ws = [w.A, w.B, w.C];
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  let pick = 0;
  for (let i = 0; i < ws.length; i++) { if ((r -= ws[i]) < 0) { pick = i; break; } pick = i; }
  const pet: GamePet = { uid: uid('p'), speciesId: list[pick].id, stage: 1, level: 1, hearts: 0, deco: null };
  set({ ...state, eggs: state.eggs.filter((e) => e.uid !== eggUid), pets: [...state.pets, pet] });
  return pet;
}

export function setDeco(petUid: string, deco: string | null) {
  set({ ...state, pets: state.pets.map((p) => (p.uid === petUid ? { ...p, deco } : p)) });
}
