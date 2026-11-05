/** 저택 리모델링 — 순수 함수. 모든 변경은 새 상태를 돌려주며, 실패 시 원래 상태를 그대로 돌려준다(원자성). */
import type { LedgerEntry, MansionState, RenovationTask, StageDef, StageStatus, TaskStatus } from './types';

// ─────────────────────────── 별 원장 ───────────────────────────
export const starBalance = (m: Pick<MansionState, 'ledger'>) =>
  m.ledger.reduce((a, e) => a + (e.type === 'earn' ? e.amount : -e.amount), 0);
export const starsEarned = (m: Pick<MansionState, 'ledger'>) => m.ledger.filter((e) => e.type === 'earn').reduce((a, e) => a + e.amount, 0);
const hasKey = (m: MansionState, key: string) => m.ledger.some((e) => e.idempotencyKey === key);

export const earnKey = (stageId: string) => `earn:stage:${stageId}`;
export const spendKey = (taskId: string) => `spend:task:${taskId}`;

export function earn(m: MansionState, key: string, amount: number, sourceId: string, at: string): { state: MansionState; granted: boolean } {
  if (amount <= 0 || hasKey(m, key)) return { state: m, granted: false };
  const e: LedgerEntry = { id: `tx-${m.ledger.length + 1}-${key}`, idempotencyKey: key, type: 'earn', amount, sourceId, createdAt: at };
  return { state: { ...m, ledger: [...m.ledger, e] }, granted: true };
}

// ─────────────────────────── 스테이지 ───────────────────────────
export function stageStatus(m: MansionState, st: StageDef): StageStatus {
  const p = m.stages[st.id];
  if (p?.status === 'cleared') return 'cleared';
  if (st.prerequisites.some((id) => m.stages[id]?.status !== 'cleared')) return 'locked';
  return p?.status === 'in_progress' ? 'in_progress' : 'available';
}

export function startStage(m: MansionState, st: StageDef): { state: MansionState; ok: boolean } {
  const s = stageStatus(m, st);
  if (s === 'locked') return { state: m, ok: false };
  if (s !== 'available') return { state: m, ok: true };
  return { state: { ...m, stages: { ...m.stages, [st.id]: { stageId: st.id, status: 'in_progress', bestScore: 0, lastScore: 0, attempts: 0 } } }, ok: true };
}

export interface StageResult { passed: boolean; firstClear: boolean; starsGranted: number; duplicate: boolean; correct: number; total: number }

/**
 * 스테이지 결과 반영. 정답 판정은 문항 id 에 매핑된 정답으로 이미 끝난 상태(correct 수)를 받는다.
 * - passingScore 이상이면 통과, 같은 stageId 의 '최초' 통과에만 rewardStars 지급 (idempotencyKey = earn:stage:<id>)
 * - 같은 attemptId 는 한 번만 처리 (결과 화면 더블 탭·새로고침 재전송)
 */
export function recordStageResult(m: MansionState, st: StageDef, attemptId: string, correct: number, at: string): { state: MansionState; result: StageResult } {
  const total = st.questions.length;
  const base: StageResult = { passed: correct >= st.passingScore, firstClear: false, starsGranted: 0, duplicate: false, correct, total };
  if (m.processedAttempts.includes(attemptId)) return { state: m, result: { ...base, duplicate: true } };
  if (stageStatus(m, st) === 'locked') return { state: m, result: { ...base, passed: false } };
  const prev = m.stages[st.id];
  const wasCleared = prev?.status === 'cleared';
  const passed = base.passed;
  let next: MansionState = {
    ...m,
    processedAttempts: [...m.processedAttempts, attemptId].slice(-200),
    stages: {
      ...m.stages,
      [st.id]: {
        stageId: st.id,
        status: wasCleared || passed ? 'cleared' : 'in_progress',
        bestScore: Math.max(prev?.bestScore ?? 0, correct),
        lastScore: correct,
        attempts: (prev?.attempts ?? 0) + 1,
        firstClearedAt: prev?.firstClearedAt ?? (passed ? at : undefined),
      },
    },
  };
  let starsGranted = 0;
  if (passed && !wasCleared) {
    const e = earn(next, earnKey(st.id), st.rewardStars, st.id, at);
    next = e.state;
    if (e.granted) starsGranted = st.rewardStars;
  }
  return { state: next, result: { ...base, firstClear: passed && !wasCleared, starsGranted } };
}

// ─────────────────────────── 리모델링 ───────────────────────────
export function taskStatus(m: MansionState, t: RenovationTask): TaskStatus {
  if (m.renovations[t.id]?.status === 'completed') return 'completed';
  return lockReason(m, t) ? 'locked' : 'available';
}

/** 잠금 사유 (선행 미션 → 선행 스토리 순). 열려 있으면 null */
export function lockReason(m: MansionState, t: RenovationTask): { type: 'task'; id: string } | { type: 'event'; id: string } | { type: 'asset'; id: string } | null {
  if (t.ready === false) return { type: 'asset', id: t.id };
  const task = t.prerequisiteTaskIds.find((id) => m.renovations[id]?.status !== 'completed');
  if (task) return { type: 'task', id: task };
  const ev = t.requiresEvents?.find((id) => !m.story?.completedEvents.includes(id));
  return ev ? { type: 'event', id: ev } : null;
}

export type RenovateError = 'locked' | 'already' | 'insufficient' | 'variant-required' | 'invalid-variant' | 'duplicate';

/** 별 차감 + 작업 완료를 하나의 커밋으로 처리. 하나라도 실패하면 아무것도 바뀌지 않는다. */
export function renovate(m: MansionState, t: RenovationTask, variantId: string | undefined, at: string): { state: MansionState; ok: boolean; error?: RenovateError } {
  const fail = (error: RenovateError) => ({ state: m, ok: false, error });
  const st = taskStatus(m, t);
  if (st === 'completed') return fail('already');
  if (st === 'locked') return fail('locked');
  if (t.variants?.length) {
    if (!variantId) return fail('variant-required');
    if (!t.variants.some((v) => v.id === variantId)) return fail('invalid-variant');
  }
  const key = spendKey(t.id);
  if (hasKey(m, key)) return fail('duplicate');
  if (starBalance(m) < t.costStars) return fail('insufficient');
  const e: LedgerEntry = { id: `tx-${m.ledger.length + 1}-${key}`, idempotencyKey: key, type: 'spend', amount: t.costStars, sourceId: t.id, createdAt: at };
  return {
    state: {
      ...m,
      ledger: [...m.ledger, e],
      renovations: { ...m.renovations, [t.id]: { taskId: t.id, status: 'completed', selectedVariantId: t.variants?.length ? variantId : undefined, completedAt: at } },
    },
    ok: true,
  };
}

/** 이미 완료한 작업의 스타일 교체 — 별 차감 없음 */
export function changeVariant(m: MansionState, t: RenovationTask, variantId: string): { state: MansionState; ok: boolean } {
  const r = m.renovations[t.id];
  if (!r || r.status !== 'completed' || !t.variants?.some((v) => v.id === variantId)) return { state: m, ok: false };
  if (r.selectedVariantId === variantId) return { state: m, ok: true };
  return { state: { ...m, renovations: { ...m.renovations, [t.id]: { ...r, selectedVariantId: variantId } } }, ok: true };
}

/** 현재 진행할 작업 (가장 앞선 미완료 작업) */
export function currentTask(m: MansionState, tasks: RenovationTask[]): RenovationTask | null {
  return [...tasks].sort((a, b) => a.order - b.order).find((t) => t.ready !== false && taskStatus(m, t) !== 'completed') ?? null;
}

export function roomProgress(m: MansionState, tasks: RenovationTask[]) {
  const done = tasks.filter((t) => taskStatus(m, t) === 'completed').length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}

/** 렌더용: 슬롯 → 표시할 variant (미리보기 우선) */
export function resolveVariant(m: MansionState, t: RenovationTask, preview?: { taskId: string; variantId: string } | null) {
  if (preview && preview.taskId === t.id) return t.variants?.find((v) => v.id === preview.variantId) ?? null;
  const r = m.renovations[t.id];
  if (!r) return null;
  return t.variants?.find((v) => v.id === r.selectedVariantId) ?? null;
}

// ─────────────────────────── 스토리 (멱등 커밋) ───────────────────────────
export function storyStart(m: MansionState, eventId: string): MansionState {
  if (m.story.completedEvents.includes(eventId) || m.story.currentEventId === eventId) return m;
  return { ...m, story: { ...m.story, currentEventId: eventId } };
}
export function storyComplete(m: MansionState, eventId: string): MansionState {
  const done = m.story.completedEvents.includes(eventId);
  if (done && m.story.currentEventId !== eventId) return m;
  return { ...m, story: { ...m.story, completedEvents: done ? m.story.completedEvents : [...m.story.completedEvents, eventId], currentEventId: m.story.currentEventId === eventId ? null : m.story.currentEventId } };
}
export function grantClue(m: MansionState, clueId: string, eventId: string, at: string): { state: MansionState; granted: boolean } {
  if (m.story.clues[clueId]) return { state: m, granted: false };
  return { state: { ...m, story: { ...m.story, clues: { ...m.story.clues, [clueId]: { foundAt: at, eventId } } } }, granted: true };
}
export function recordQuiz(m: MansionState, quizId: string, correct: boolean, at: string): MansionState {
  const prev = m.story.quizzes[quizId];
  if (prev?.solved) return m; // 이미 푼 퀴즈는 기록 고정
  return { ...m, story: { ...m.story, quizzes: { ...m.story.quizzes, [quizId]: { solved: correct, attempts: (prev?.attempts ?? 0) + 1, solvedAt: correct ? at : undefined } } } };
}
