/** 학습 세트 보상·오늘의 퀘스트 — 순수 함수. 별은 저택 별 원장(mansion.ledger) 하나로 지급한다. */
import { DAILY_BONUS_STARS, DAILY_QUESTS, REWARD_POLICY, SET_AREA, type ActivityArea, type DailyQuestDef, type SetType } from '@/config/rewards';
import { earn } from '@/domain/mansion/logic';
import type { MansionState } from '@/domain/mansion/types';

export interface SetRecord {
  setId: string;
  type: SetType;
  attempts: number;
  bestAccuracy: number;
  lastAccuracy: number;
  /** rewarded: 별 지급 완료 · pending-review: 정답률 미달 → 틀린 문제 복습 후 지급 */
  status: 'rewarded' | 'pending-review';
  wrongIds: string[];
  firstCompletedAt: string;
  rewardedAt?: string;
}

export interface RewardsState {
  sets: Record<string, SetRecord>;
  /** 날짜(YYYY-MM-DD) → 영역별 푼 문제 수 */
  activity: Record<string, Partial<Record<ActivityArea, number>>>;
  /** 처리한 학습 시도 id (중복 제출 방지) */
  processed: string[];
}
export const initialRewards = (): RewardsState => ({ sets: {}, activity: {}, processed: [] });

export const setEarnKey = (setId: string) => `earn:set:${setId}`;
export const questEarnKey = (date: string) => `earn:quest:${date}`;

export type SetOutcome = { status: 'rewarded' | 'already-rewarded' | 'pending-review' | 'duplicate'; starsGranted: number; accuracy: number };

/** 세트 완료 처리 (별 지급 판단 포함). mansion 과 rewards 를 함께 돌려준다 */
export function completeSet(r: RewardsState, m: MansionState, input: { setId: string; type: SetType; correct: number; total: number; wrongIds: string[]; attemptId: string; date: string; at: string }) {
  const accuracy = input.total ? input.correct / input.total : 0;
  if (r.processed.includes(input.attemptId)) return { rewards: r, mansion: m, outcome: { status: 'duplicate', starsGranted: 0, accuracy } as SetOutcome };
  const area = SET_AREA[input.type];
  const day = r.activity[input.date] ?? {};
  const activity = { ...r.activity, [input.date]: { ...day, [area]: (day[area] ?? 0) + input.total } };
  const prev = r.sets[input.setId];
  let mansion = m;
  let outcome: SetOutcome;
  let rec: SetRecord;
  const base = { setId: input.setId, type: input.type, attempts: (prev?.attempts ?? 0) + 1, bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy), lastAccuracy: accuracy, firstCompletedAt: prev?.firstCompletedAt ?? input.at };
  if (prev?.status === 'rewarded') {
    rec = { ...prev, ...base };
    outcome = { status: 'already-rewarded', starsGranted: 0, accuracy };
  } else if (accuracy >= REWARD_POLICY.passAccuracy) {
    const e = earn(mansion, setEarnKey(input.setId), REWARD_POLICY.starsPerSet, input.setId, input.at);
    mansion = e.state;
    rec = { ...base, status: 'rewarded', wrongIds: input.wrongIds, rewardedAt: input.at };
    outcome = { status: e.granted ? 'rewarded' : 'already-rewarded', starsGranted: e.granted ? REWARD_POLICY.starsPerSet : 0, accuracy };
  } else {
    rec = { ...base, status: 'pending-review', wrongIds: input.wrongIds };
    outcome = { status: 'pending-review', starsGranted: 0, accuracy };
  }
  return { rewards: { ...r, activity, sets: { ...r.sets, [input.setId]: rec }, processed: [...r.processed, input.attemptId].slice(-300) }, mansion, outcome };
}

/** 정답률 미달 세트: 틀린 문제를 모두 다시 맞힌 뒤 호출 → 별 지급 (최초 1회) */
export function completeSetReview(r: RewardsState, m: MansionState, setId: string, at: string) {
  const rec = r.sets[setId];
  if (!rec || rec.status !== 'pending-review') return { rewards: r, mansion: m, starsGranted: 0 };
  const e = earn(m, setEarnKey(setId), REWARD_POLICY.starsPerSet, setId, at);
  return { rewards: { ...r, sets: { ...r.sets, [setId]: { ...rec, status: 'rewarded' as const, rewardedAt: at } } }, mansion: e.state, starsGranted: e.granted ? REWARD_POLICY.starsPerSet : 0 };
}

/** 오늘의 퀘스트 목록 (음성 미지원이면 대체 퀘스트) */
export function todaysQuests(audioSupported: boolean): Omit<DailyQuestDef, 'fallback'>[] {
  return DAILY_QUESTS.map((q) => (q.requires === 'audio' && !audioSupported && q.fallback ? q.fallback : q));
}

export function questProgress(r: RewardsState, date: string, audioSupported: boolean) {
  const day = r.activity[date] ?? {};
  const items = todaysQuests(audioSupported).map((q) => { const v = Math.min(q.target, day[q.area] ?? 0); return { ...q, value: v, done: v >= q.target }; });
  return { items, allDone: items.every((i) => i.done), doneCount: items.filter((i) => i.done).length };
}

/** 모든 퀘스트 완료 시 보너스 (날짜당 1회) */
export function grantDailyBonus(r: RewardsState, m: MansionState, date: string, audioSupported: boolean, at: string) {
  if (!questProgress(r, date, audioSupported).allDone) return { mansion: m, granted: false };
  const e = earn(m, questEarnKey(date), DAILY_BONUS_STARS, `quest:${date}`, at);
  return { mansion: e.state, granted: e.granted };
}

export const bonusClaimed = (m: MansionState, date: string) => m.ledger.some((e) => e.idempotencyKey === questEarnKey(date));
