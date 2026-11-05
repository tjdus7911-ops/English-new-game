import { clear, get as idbGet } from 'idb-keyval';
import { useApp, initialState, migrate, validatePersisted, STORE_KEY } from '@/store/app';
import { STAGES, STAGE_BY_ID, stagesOf } from '@/content/mansion/stages';
import { LIVING_TASKS, LIVING_TOTAL_COST } from '@/content/mansion/tasks';
import { currentTask, earn, lockReason as lockReasonOf, renovate, starBalance, stageStatus, taskStatus, recordStageResult, changeVariant } from '@/domain/mansion/logic';
import { initialMansionState as baseMansion, type MansionState } from '@/domain/mansion/types';

/** 리모델링 규칙만 검사할 때: 스토리 선행 조건을 충족한 상태 */
const STORY_DONE = ['prologue', 'ch1-clean', 'ch1-letter', 'ch1-key', 'ch1-pattern', 'ch1-photo'];
const withStory = (m: MansionState): MansionState => ({ ...m, story: { ...m.story, completedEvents: [...STORY_DONE] } });
const initialMansionState = () => withStory(baseMansion());
import { questionById } from '@/lib/questionIndex';
import type { Question } from '@/domain/types';

const at = '2026-11-04T00:00:00.000Z';
const answersFor = (stageId: string, nCorrect: number) =>
  STAGE_BY_ID[stageId].questions.map((q: Question, i) => ({
    questionId: q.id, conceptId: q.conceptId, correct: i < nCorrect, source: 'lesson' as const,
    // 클라이언트가 correct 를 속여도 store 가 문항 id 의 정답으로 재채점하는지 확인하기 위해 given 으로만 판정
    given: i < nCorrect ? q.answers[0] : '__wrong__',
  }));
const flush = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  await clear();
  const init = initialState();
  useApp.setState({ ...init, mansion: withStory(init.mansion), hydrated: true });
});

describe('콘텐츠 구성', () => {
  it('스테이지는 모두 5문항, 4문항 통과, 1별, 문항 id 로 정답·해설을 찾을 수 있다', () => {
    expect(STAGES.length).toBe(36);
    for (const s of STAGES) {
      expect(s.questions, s.id).toHaveLength(5);
      expect(s.passingScore).toBe(4);
      expect(s.rewardStars).toBe(1);
      for (const q of s.questions) {
        expect(q.answers.length, q.id).toBeGreaterThan(0);
        expect(q.explanation, q.id).toBeTruthy();
        if (q.type === 'mc' || q.type === 'translate') expect(q.choices).toContain(q.answers[0]);
        expect(questionById(q.id)?.answers, `오답노트 연결 ${q.id}`).toEqual(q.answers);
      }
      expect(s.source).toBeTruthy();
    }
    for (const a of ['vocabulary', 'grammar', 'reading', 'exam'] as const) expect(stagesOf(a).length).toBeGreaterThanOrEqual(6);
    expect(stagesOf('exam').every((s) => s.source.includes('공식 시험과 무관'))).toBe(true);
  });
  it('리모델링 작업 40개(청소7·수리7·가구8·조명6·소품12), 단계 순서, 교체형은 서로 다른 에셋 3종, 오브젝트 1:1', () => {
    expect(LIVING_TASKS).toHaveLength(40);
    const count = (p: string) => LIVING_TASKS.filter((t) => t.phase === p).length;
    expect([count('clean'), count('repair'), count('furniture'), count('lighting'), count('decor')]).toEqual([7, 7, 8, 6, 12]);
    expect(LIVING_TOTAL_COST).toBe(56);
    const order = { clean: 0, repair: 1, furniture: 2, lighting: 3, decor: 4 };
    for (let i = 1; i < LIVING_TASKS.length; i++) expect(order[LIVING_TASKS[i].phase]).toBeGreaterThanOrEqual(order[LIVING_TASKS[i - 1].phase]);
    for (const t of LIVING_TASKS) {
      expect(t.objectId, t.id).toBeTruthy();
      if (t.ready === false) { expect(t.assetNote, t.id).toBeTruthy(); continue; }
      if (!t.variants) continue;
      expect(t.variants).toHaveLength(3);
      expect(new Set(t.variants!.map((v) => v.assetKey)).size).toBe(3);
    }
    for (const t of LIVING_TASKS.filter((x) => x.costStars > 0)) expect(t.costStars).toBeLessThanOrEqual(3);
  });
});

describe('수용 기준 (도메인)', () => {
  it('1. 신규 유저: 별 0, A1 만 활성 (디자인 준비 중 작업은 잠김)', () => {
    const m = initialMansionState();
    expect(starBalance(m)).toBe(0);
    expect(LIVING_TASKS.map((t) => taskStatus(m, t))).toEqual(['available', ...Array(39).fill('locked')]);
    expect(currentTask(m, LIVING_TASKS)?.id).toBe('A1');
    expect(LIVING_TASKS.filter((t) => t.ready === false).every((t) => lockReasonOf(m, t)?.type === 'asset')).toBe(true);
  });
  it('2. 5문제 중 4개 정답 → 최초 1별, 재클리어 0별, 3개 정답은 실패', () => {
    const st = STAGES[0];
    let m = initialMansionState();
    let r = recordStageResult(m, st, 'a1', 3, at);
    expect(r.result.passed).toBe(false); expect(starBalance(r.state)).toBe(0);
    r = recordStageResult(r.state, st, 'a2', 4, at);
    expect(r.result).toMatchObject({ passed: true, firstClear: true, starsGranted: 1 });
    r = recordStageResult(r.state, st, 'a3', 5, at);
    expect(r.result).toMatchObject({ passed: true, firstClear: false, starsGranted: 0 });
    m = r.state;
    expect(starBalance(m)).toBe(1);
    expect(m.stages[st.id]).toMatchObject({ status: 'cleared', bestScore: 5, attempts: 3 });
  });
  it('스테이지 선행 조건: 앞 스테이지를 통과해야 다음이 열린다', () => {
    const [a, b] = stagesOf('vocabulary');
    let m = initialMansionState();
    expect(stageStatus(m, b)).toBe('locked');
    expect(recordStageResult(m, b, 'x', 5, at).result.passed).toBe(false);
    m = recordStageResult(m, a, 'y', 5, at).state;
    expect(stageStatus(m, b)).toBe('available');
  });
  it('3. A1 별 1개 사용 → 별 0, A2 활성 / 4. 별 부족 시 불가', () => {
    let m = recordStageResult(initialMansionState(), STAGES[0], 'a', 5, at).state;
    const r1 = renovate(m, LIVING_TASKS[0], undefined, at);
    expect(r1.ok).toBe(true);
    m = r1.state;
    expect(starBalance(m)).toBe(0);
    expect(taskStatus(m, LIVING_TASKS[1])).toBe('available');
    const r2 = renovate(m, LIVING_TASKS[1], undefined, at);
    expect(r2).toMatchObject({ ok: false, error: 'insufficient' });
    expect(r2.state).toBe(m); // 실패 시 아무것도 바뀌지 않음
  });
  it('5·6. 가구형은 선택 필수, 완료 후 교체는 무료', () => {
    let m = initialMansionState();
    m = { ...m, story: { ...m.story, completedEvents: ['prologue', 'ch1-key'] } };
    for (let i = 0; i < 12; i++) m = recordStageResult(m, STAGES[i], `s${i}`, 5, at).state;
    for (let i = 0; i < 7; i++) m = renovate(m, LIVING_TASKS[i], undefined, at).state;
    const B8 = LIVING_TASKS[7], B9 = LIVING_TASKS[8];
    expect(B8.id).toBe('B8');
    expect(renovate(m, B8, undefined, at).error).toBe('variant-required');
    expect(renovate(m, B8, 'nope', at).error).toBe('invalid-variant');
    m = renovate(m, B8, 'wp-mint', at).state;
    const bal = starBalance(m);
    const c = changeVariant(m, B8, 'wp-damask');
    expect(c.ok).toBe(true);
    expect(starBalance(c.state)).toBe(bal);
    expect(c.state.renovations.B8.selectedVariantId).toBe('wp-damask');
    expect(changeVariant(m, B9, 'fl-tile').ok).toBe(false); // 미완료 작업은 교체 불가
  });
  it('8. 같은 작업 두 번 실행·같은 시도 두 번 제출 → 중복 소비·지급 없음', () => {
    let m = recordStageResult(initialMansionState(), STAGES[0], 'same', 5, at).state;
    const again = recordStageResult(m, STAGES[0], 'same', 5, at);
    expect(again.result.duplicate).toBe(true);
    expect(again.state).toBe(m);
    m = recordStageResult(m, STAGES[1], 'b', 5, at).state;
    m = renovate(m, LIVING_TASKS[0], undefined, at).state;
    const twice = renovate(m, LIVING_TASKS[0], undefined, at);
    expect(twice.ok).toBe(false);
    expect(starBalance(twice.state)).toBe(1);
    expect(twice.state.ledger.filter((e) => e.type === 'spend')).toHaveLength(1);
  });
});

describe('수용 기준 (스토어 통합 · 저장)', () => {
  it('학습 → 별 → A1 → 저장 후 재시작 시 유지 (7)', async () => {
    const api = useApp.getState();
    const st = STAGES[0];
    expect(api.startMansionStage(st.id)).toBe(true);
    const r = api.completeMansionStage(st.id, 'att-1', answersFor(st.id, 4));
    expect(r).toMatchObject({ passed: true, starsGranted: 1, correct: 4 });
    // 더블 탭: 같은 시도 id 재전송
    expect(useApp.getState().completeMansionStage(st.id, 'att-1', answersFor(st.id, 4))?.duplicate).toBe(true);
    expect(starBalance(useApp.getState().mansion)).toBe(1);
    // 오답노트에 틀린 1문항 기록
    const wrongQ = st.questions[4].id;
    expect(useApp.getState().learning.wrongNotes[wrongQ]).toMatchObject({ lastGiven: '__wrong__', resolved: false });
    expect(useApp.getState().renovateTask('A1').ok).toBe(true);
    expect(useApp.getState().renovateTask('A1').ok).toBe(false);
    await flush();
    const raw = JSON.parse((await idbGet<string>(STORE_KEY))!);
    expect(raw.state.mansion.renovations.A1.status).toBe('completed');
    expect(raw.state.mansion.ledger).toHaveLength(2);
    // 재시작 시뮬레이션: 저장본 → 검증 → 마이그레이션
    const restored = migrate(validatePersisted(raw.state), raw.version);
    expect(starBalance(restored.mansion)).toBe(0);
    expect(restored.mansion.stages[st.id].status).toBe('cleared');
    expect(restored.learning.wrongNotes[wrongQ]).toBeTruthy();
  });
  it('클라이언트 correct 값이 아니라 정답 데이터로 재채점한다', () => {
    const st = STAGES[0];
    const fake = answersFor(st.id, 1).map((a) => ({ ...a, correct: true }));
    expect(useApp.getState().completeMansionStage(st.id, 'att-x', fake)).toMatchObject({ correct: 1, passed: false, starsGranted: 0 });
  });
  it('9. 학습 중도 종료(결과 미제출) 시 보상 없음 — 시작만 기록', () => {
    useApp.getState().startMansionStage(STAGES[0].id);
    const m = useApp.getState().mansion;
    expect(m.stages[STAGES[0].id].status).toBe('in_progress');
    expect(starBalance(m)).toBe(0);
  });
  it('v3 저장본 마이그레이션: 기존 기록 유지 + 저택 기본값', () => {
    const v3 = { ...initialState(), version: 3 } as Record<string, unknown>;
    delete v3.mansion;
    const out = migrate(v3, 3);
    expect(out.mansion).toEqual(baseMansion());
    expect(out.settings.sound).toBe(true);
    expect(validatePersisted({ ...out, mansion: { ledger: 'bad' } })).toBeNull();
  });
  it('준비된 작업 전부: 스테이지 최초 통과 별로 순서대로 완료, 디자인 준비 중 작업은 실행 불가', () => {
    for (const st of STAGES) useApp.getState().completeMansionStage(st.id, `a-${st.id}`, answersFor(st.id, 5));
    const ready = LIVING_TASKS.filter((t) => t.ready !== false);
    const cost = ready.reduce((a, t) => a + t.costStars, 0);
    // 학습 스테이지 최초 통과 별(36)만으로는 부족 → 나머지는 퀘스트 보상(4단계)으로 받는다. 여기서는 퀘스트 보상 대신 직접 지급
    const fromStages = starBalance(useApp.getState().mansion);
    const gap = Math.max(0, cost - fromStages);
    if (gap) useApp.setState((s) => ({ mansion: earn(s.mansion, 'earn:test:quest-stand-in', gap, 'test', at).state }));
    const earned = starBalance(useApp.getState().mansion);
    expect(earned).toBeGreaterThanOrEqual(cost);
    useApp.setState((s) => ({ mansion: { ...s.mansion, story: { ...s.mansion.story, completedEvents: ['prologue', 'ch1-key'] } } }));
    for (const t of ready) expect(useApp.getState().renovateTask(t.id, t.variants?.[0].id).ok, t.id).toBe(true);
    for (const t of LIVING_TASKS.filter((x) => x.ready === false)) expect(useApp.getState().renovateTask(t.id, t.variants?.[0].id).ok, t.id).toBe(false);
    expect(starBalance(useApp.getState().mansion)).toBe(earned - cost);
  });
});

describe('스토리 연동 잠금', () => {
  it('프롤로그 전에는 A1 잠김, 그림 뒤 열쇠 이벤트 전에는 B8(벽지 교체) 잠김', async () => {
    const { lockReason } = await import('@/domain/mansion/logic');
    let m = baseMansion();
    expect(taskStatus(m, LIVING_TASKS[0])).toBe('locked');
    expect(lockReason(m, LIVING_TASKS[0])).toEqual({ type: 'event', id: 'prologue' });
    m = { ...m, story: { ...m.story, completedEvents: ['prologue'] } };
    m = recordStageResult(m, STAGES[0], 'a', 5, at).state;
    m = recordStageResult(m, STAGES[1], 'b', 5, at).state;
    m = recordStageResult(m, STAGES[2], 'c', 5, at).state;
    m = recordStageResult(m, STAGES[3], 'd', 5, at).state;
    for (let i = 4; i < 9; i++) m = recordStageResult(m, STAGES[i], `x${i}`, 5, at).state;
    for (let i = 0; i < 7; i++) m = renovate(m, LIVING_TASKS[i], undefined, at).state;
    expect(lockReason(m, LIVING_TASKS[7])).toEqual({ type: 'event', id: 'ch1-key' });
    expect(renovate(m, LIVING_TASKS[7], 'wp-mint', at).error).toBe('locked');
  });
});
