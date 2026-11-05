import { clear } from 'idb-keyval';
import { useApp, initialState, migrate } from '@/store/app';
import { completeSet, completeSetReview, grantDailyBonus, initialRewards, questProgress, todaysQuests, setEarnKey } from '@/domain/rewards/logic';
import { migrateRenovationsV2, migrateRenovationsV3 } from '@/domain/mansion/migrate';
import { initialMansionState, type MansionState } from '@/domain/mansion/types';
import { starBalance, taskStatus, renovate, earn } from '@/domain/mansion/logic';
import { LIVING_TASKS, LIVING_TASK_BY_ID } from '@/content/mansion/tasks';
import { REWARD_POLICY, SET_SIZE } from '@/config/rewards';

const at = '2026-11-04T01:00:00.000Z';
const date = '2026-11-04';
const base = { type: 'grammar' as const, total: 5, date, at };

describe('학습 세트 별 보상 (config/rewards)', () => {
  it('정답률 60% 이상 → 완료 즉시 별 1, 같은 세트 재완료는 0 (기록만 갱신)', () => {
    let r = initialRewards(); let m = initialMansionState();
    let o = completeSet(r, m, { ...base, setId: 'g:1', correct: 3, wrongIds: ['a', 'b'], attemptId: 'x1' });
    expect(o.outcome).toMatchObject({ status: 'rewarded', starsGranted: 1 });
    r = o.rewards; m = o.mansion;
    expect(starBalance(m)).toBe(1);
    o = completeSet(r, m, { ...base, setId: 'g:1', correct: 5, wrongIds: [], attemptId: 'x2' });
    expect(o.outcome).toMatchObject({ status: 'already-rewarded', starsGranted: 0 });
    expect(starBalance(o.mansion)).toBe(1);
    expect(o.rewards.sets['g:1']).toMatchObject({ attempts: 2, bestAccuracy: 1 });
  });
  it('정답률 60% 미만 → 보류, 틀린 문제 복습 완료 후 별 1 (최초 1회)', () => {
    let o = completeSet(initialRewards(), initialMansionState(), { ...base, setId: 'g:2', correct: 2, wrongIds: ['q3', 'q4', 'q5'], attemptId: 'y1' });
    expect(o.outcome.status).toBe('pending-review');
    expect(starBalance(o.mansion)).toBe(0);
    const rv = completeSetReview(o.rewards, o.mansion, 'g:2', at);
    expect(rv.starsGranted).toBe(1);
    expect(starBalance(rv.mansion)).toBe(1);
    expect(completeSetReview(rv.rewards, rv.mansion, 'g:2', at).starsGranted).toBe(0);
    // 이후 다시 풀어도 지급 없음
    o = completeSet(rv.rewards, rv.mansion, { ...base, setId: 'g:2', correct: 5, wrongIds: [], attemptId: 'y2' });
    expect(o.outcome.starsGranted).toBe(0);
  });
  it('같은 시도 id 재제출은 무시 (더블 탭)', () => {
    const o = completeSet(initialRewards(), initialMansionState(), { ...base, setId: 'g:3', correct: 5, wrongIds: [], attemptId: 'z' });
    const d = completeSet(o.rewards, o.mansion, { ...base, setId: 'g:3', correct: 5, wrongIds: [], attemptId: 'z' });
    expect(d.outcome.status).toBe('duplicate');
    expect(d.mansion.ledger.filter((e) => e.idempotencyKey === setEarnKey('g:3'))).toHaveLength(1);
  });
  it('세트 크기·정책 설정값', () => {
    expect(SET_SIZE).toMatchObject({ 'vocab-beginner': 10, 'vocab-intermediate': 8, 'vocab-advanced': 5, grammar: 5, writing: 3, listening: 5, speaking: 5, story: 3 });
    expect(REWARD_POLICY.passAccuracy).toBe(0.6);
    expect(REWARD_POLICY.answerLockMs).toBeLessThan(1000); // 빠르게 푸는 것 자체는 막지 않음
  });
});

describe('오늘의 퀘스트', () => {
  it('3개 모두 완료 시 보너스 별 1 (날짜당 1회), 음성 미지원이면 리스닝 → 동화 대체', () => {
    expect(todaysQuests(false).map((q) => q.id)).toEqual(['q-vocab', 'q-grammar', 'q-story']);
    let r = initialRewards(); let m = initialMansionState();
    const run = (setId: string, type: 'vocab-beginner' | 'grammar' | 'listening', total: number) => {
      const o = completeSet(r, m, { setId, type, correct: total, total, wrongIds: [], attemptId: setId, date, at }); r = o.rewards; m = o.mansion;
    };
    run('v:1', 'vocab-beginner', 10);
    run('g:1', 'grammar', 5);
    expect(grantDailyBonus(r, m, date, true, at).granted).toBe(false);
    run('l:1', 'listening', 5);
    expect(questProgress(r, date, true).allDone).toBe(true);
    const b = grantDailyBonus(r, m, date, true, at);
    expect(b.granted).toBe(true);
    expect(starBalance(b.mansion)).toBe(4);
    expect(grantDailyBonus(r, b.mansion, date, true, at).granted).toBe(false);
  });
});

describe('스토어: completeLearningSet / completeSetReview', () => {
  beforeEach(async () => { await clear(); useApp.setState({ ...initialState(), hydrated: true }); });
  const ans = (n: number, correct: number) => Array.from({ length: n }, (_, i) => ({ questionId: `q-${i}`, conceptId: 'a1-u01', correct: i < correct, given: 'x', source: 'lesson' as const }));
  it('세트 완료 → 통합 별 원장에 지급, 학습 기록·오답노트 반영', () => {
    const r = useApp.getState().completeLearningSet({ setId: 'vocab:t1', type: 'vocab-intermediate', attemptId: 'a1', title: '단어 세트', answers: ans(8, 5) });
    expect(r).toMatchObject({ status: 'rewarded', starsGranted: 1 });
    const s = useApp.getState();
    expect(starBalance(s.mansion)).toBe(1);
    expect(s.learning.log.at(-1)).toMatchObject({ kind: 'set', refId: 'vocab:t1' });
    expect(s.learning.wrongNotes['q-6']).toBeTruthy();
    expect(s.rewards.activity[Object.keys(s.rewards.activity)[0]].vocab).toBe(8);
  });
  it('60% 미만 → 틀린 문제를 모두 다시 맞혀야 별', () => {
    const r = useApp.getState().completeLearningSet({ setId: 'gram:x', type: 'grammar', attemptId: 'b1', title: '문법', answers: ans(5, 2) });
    expect(r.status).toBe('pending-review');
    expect(r.wrongIds).toEqual(['q-2', 'q-3', 'q-4']);
    const partial = [{ questionId: 'q-2', conceptId: 'a1-u01', correct: true, given: 'x', source: 'review' as const }];
    expect(useApp.getState().completeSetReview('gram:x', partial).starsGranted).toBe(0);
    const all = ['q-2', 'q-3', 'q-4'].map((id) => ({ questionId: id, conceptId: 'a1-u01', correct: true, given: 'x', source: 'review' as const }));
    expect(useApp.getState().completeSetReview('gram:x', all).starsGranted).toBe(1);
    expect(starBalance(useApp.getState().mansion)).toBe(1);
  });
  it('이전 마을 별(game.stars)은 삭제되지 않고 그대로 보존', () => {
    const s0 = initialState();
    const legacy = { ...s0, version: 4, game: { ...s0.game, stars: { 'e1': { eventId: 'e1', amount: 7, reason: 'old', at: 0 } } } };
    const out = migrate(legacy, 4);
    expect(out.game.stars.e1.amount).toBe(7);
    expect(starBalance(out.mansion)).toBe(0);
  });
});

describe('리모델링 마이그레이션 v1(R01~R10) → v2(L01~L11) → v3(A1~E40)', () => {
  const done = (id: string, v?: string) => ({ taskId: id, status: 'completed' as const, completedAt: at, ...(v ? { selectedVariantId: v } : {}) });
  function legacyState(): MansionState {
    let m = initialMansionState();
    for (let i = 0; i < 9; i++) m = earn(m, `earn:stage:s${i}`, 1, `s${i}`, at).state;
    // 이전 구조: R01(1) R02(2, 민트) R03(1, 장미 안락의자) R04(2, 마루) 완료 = 6별 소비
    m = { ...m, story: { ...m.story, completedEvents: ['prologue', 'ch1-clean', 'ch1-letter', 'ch1-key', 'ch1-pattern', 'ch1-photo'] },
      renovations: { R01: done('R01'), R02: done('R02', 'wp-mint'), R03: done('R03', 'arm-rose'), R04: done('R04', 'fl-parquet') },
      ledger: [...m.ledger, ...['R01', 'R02', 'R03', 'R04'].map((id, i) => ({ id: `sp${i}`, idempotencyKey: `spend:task:${id}`, type: 'spend' as const, amount: [1, 2, 1, 2][i], sourceId: id, createdAt: at }))] };
    return m;
  }
  const chain = (m: MansionState) => migrateRenovationsV3(migrateRenovationsV2(m));
  it('완료 미션 유지 · 소비 별 그대로 · 선택 디자인 유지 · 원본 보관 · 멱등', () => {
    const before = legacyState();
    expect(starBalance(before)).toBe(3);
    const mid = migrateRenovationsV2(before);
    expect(mid.renovations.L05.selectedVariantId).toBe('wp-mint');
    const m = migrateRenovationsV3(mid);
    expect(['A1', 'A2', 'A3', 'A4', 'A6', 'B8', 'B9'].map((id) => taskStatus(m, LIVING_TASK_BY_ID[id]))).toEqual(Array(7).fill('completed'));
    expect(m.renovations.B8.selectedVariantId).toBe('wp-mint');
    expect(m.renovations.B9.selectedVariantId).toBe('fl-parquet');
    expect(m.renovations.A1.migratedFrom).toBe('L01');
    expect(Object.keys(m.renovations).some((k) => /^[RL]\d\d$/.test(k))).toBe(false);
    expect(starBalance(m)).toBe(3); // 별을 다시 요구하지도, 돌려주지도 않음
    expect(m.ledger).toEqual(before.ledger);
    expect(m.legacyRenovations?.R03.selectedVariantId).toBe('arm-rose');
    expect(m.legacyRenovations?.L05.selectedVariantId).toBe('wp-mint');
    expect(m.legacyKeep?.armchair).toBe('a/armchair-rose');
    expect(migrateRenovationsV3(m)).toBe(m); // 멱등
    expect(chain(m)).toBe(m);
  });
  it('끝까지 완료한 v1 저장본 → 대응 작업 모두 완료, 소파·테이블·조명·러그 선택 유지', () => {
    let m = legacyState();
    m = { ...m, renovations: { ...m.renovations, R05: done('R05', 'sofa-pink'), R06: done('R06', 'table-stump'), R07: done('R07', 'lamp-star'), R08: done('R08', 'rug-check'), R09: done('R09', 'cab-acorn'), R10: done('R10') } };
    const out = chain(m);
    const want = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B8', 'B9', 'B12', 'C15', 'C16', 'C17', 'C18', 'D23', 'D25', 'D27', 'E33'];
    for (const id of want) expect(taskStatus(out, LIVING_TASK_BY_ID[id]), id).toBe('completed');
    expect(out.renovations.C15.selectedVariantId).toBe('sofa-pink');
    expect(out.renovations.C18.selectedVariantId).toBe('table-stump');
    expect(out.renovations.D25.selectedVariantId).toBe('lamp-star');
    expect(out.renovations.D27.selectedVariantId).toBe('rug-check');
    expect(out.renovations.E33.selectedVariantId).toBe('deco-forest');
    expect(out.legacyKeep).toMatchObject({ cabinet: 'a/china-cabinet' });
    expect(LIVING_TASKS.every((t) => taskStatus(out, t) === 'completed')).toBe(false); // 새 작업이 남아 있어 거실 미완성
  });
  it('마이그레이션 후 다음 작업은 새 비용으로 진행', () => {
    let m = chain(legacyState());
    const next = LIVING_TASKS.find((t) => taskStatus(m, t) === 'available')!;
    expect(next.id).toBe('A5');
    const r = renovate(m, next, undefined, at);
    expect(r.ok).toBe(true);
    m = r.state;
    expect(starBalance(m)).toBe(2);
  });
  it('스토어 migrate(v4·v5 저장본) 에서 자동 적용', () => {
    const s0 = initialState();
    const out = migrate({ ...s0, version: 4, mansion: legacyState() }, 4);
    expect(out.mansion.renovations.B8.selectedVariantId).toBe('wp-mint');
    expect(out.rewards.sets).toEqual({});
    expect(out.version).toBe(6);
    const v5 = migrate({ ...s0, version: 5, mansion: migrateRenovationsV2(legacyState()) }, 5);
    expect(v5.mansion.renovations).toEqual(out.mansion.renovations);
  });
});
