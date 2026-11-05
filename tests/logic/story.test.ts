import { STORY_EVENTS, EVENT_BY_ID } from '@/content/story/events';
import { CLUES, CLUE_BY_ID } from '@/content/story/clues';
import { QUIZ_BY_ID, STORY_QUIZZES } from '@/content/story/quizzes';
import { CHARACTERS } from '@/content/story/characters';
import { CHAPTERS } from '@/content/story/chapters';
import { FOCUS, SPOTS, INTERACTABLES } from '@/game/mansion/mapData';
import { LIVING_TASK_BY_ID } from '@/content/mansion/tasks';
import { initialMansionState } from '@/domain/mansion/types';
import { grantClue, recordQuiz, storyComplete, storyStart } from '@/domain/mansion/logic';
import { chapterState, interactEvent, nextAutoEvent } from '@/domain/story/logic';
import { hasAsset } from '@/game/assets';
import SPRITES from '@/game/mansion/sprites.json';

const at = '2026-11-04T00:00:00.000Z';

describe('스토리 데이터 무결성', () => {
  it('모든 단계가 존재하는 캐릭터·지점·포커스·퀴즈·단서·에셋을 참조한다', () => {
    for (const e of STORY_EVENTS) {
      for (const r of e.requires ?? []) expect(EVENT_BY_ID[r], `${e.id} requires ${r}`).toBeTruthy();
      if (e.trigger.type === 'taskCompleted') expect(LIVING_TASK_BY_ID[e.trigger.taskId]).toBeTruthy();
      if (e.trigger.type === 'interact') expect(INTERACTABLES.some((i) => i.id === (e.trigger as { objectId: string }).objectId)).toBe(true);
      for (const s of e.steps) {
        if ('who' in s) expect(CHARACTERS[s.who], `${e.id} who`).toBeTruthy();
        if (s.t === 'say' && s.expr) expect(CHARACTERS[s.who].expressions).toContain(s.expr);
        if (s.t === 'act') expect(CHARACTERS[s.who].actions).toContain(s.action);
        if (s.t === 'move') expect(SPOTS[s.to], `${e.id} spot ${s.to}`).toBeTruthy();
        if (s.t === 'place') expect(SPOTS[s.at]).toBeTruthy();
        if (s.t === 'camera') expect(FOCUS[s.focus], `${e.id} focus ${s.focus}`).toBeTruthy();
        if (s.t === 'quiz') expect(QUIZ_BY_ID[s.id]).toBeTruthy();
        if (s.t === 'clue') expect(CLUE_BY_ID[s.id]).toBeTruthy();
        if (s.t === 'reveal') expect(hasAsset(s.assetKey), s.assetKey).toBe(true);
      }
    }
    for (const c of CLUES) { expect(hasAsset(c.assetKey), c.assetKey).toBe(true); expect(EVENT_BY_ID[c.eventId]).toBeTruthy(); }
    for (const p of Object.values(CHARACTERS)) {
      expect(hasAsset(p.sprite) && hasAsset(p.portrait)).toBe(true);
      const meta = (SPRITES as Record<string, { rows: { action: string }[]; expressions?: string[] }>)[p.sprite];
      for (const a of p.actions) expect(meta.rows.map((r) => r.action), `${p.id} ${a}`).toContain(a);
      const pm = (SPRITES as Record<string, { expressions?: string[] }>)[p.portrait];
      for (const x of p.expressions) expect(pm.expressions).toContain(x);
    }
  });
  it('퀴즈 정답이 보기/토큰과 맞고, 힌트·전체 해석이 있다', () => {
    for (const q of STORY_QUIZZES) {
      if (q.type === 'choice') expect(q.choices).toContain(q.answer);
      else expect([...q.tokens!].sort().join(' ')).toBe(q.answer.split(' ').sort().join(' '));
      expect(q.glosses.length).toBeGreaterThan(0);
      expect(q.translation).toBeTruthy();
    }
  });
  it('미완성 챕터는 플레이 불가로 표시된다', () => {
    const m = initialMansionState();
    expect(CHAPTERS.filter((c) => c.available).map((c) => c.id)).toEqual(['prologue', 'ch1']);
    expect(chapterState(m, CHAPTERS[2], STORY_EVENTS).playable).toBe(false);
  });
});

describe('스토리 진행·저장 (멱등)', () => {
  it('첫 입장 → 프롤로그, 이벤트 도중 종료 시 같은 이벤트부터 재개', () => {
    let m = initialMansionState();
    expect(nextAutoEvent(m, STORY_EVENTS)?.id).toBe('prologue');
    m = storyStart(m, 'prologue');
    m = grantClue(m, 'clue-inherit-letter', 'prologue', at).state;
    // 앱 종료 후 재실행
    expect(nextAutoEvent(m, STORY_EVENTS)?.id).toBe('prologue');
    expect(grantClue(m, 'clue-inherit-letter', 'prologue', at).granted).toBe(false); // 중복 지급 없음
    m = storyComplete(m, 'prologue');
    expect(m.story.currentEventId).toBeNull();
    expect(nextAutoEvent(m, STORY_EVENTS)).toBeNull();
  });
  it('미션 완료 후 연출 전에 종료돼도, 다음 입장 때 연결된 이벤트가 실행된다', () => {
    let m = storyComplete(initialMansionState(), 'prologue');
    m = { ...m, renovations: { A1: { taskId: 'A1', status: 'completed', completedAt: at } } };
    expect(nextAutoEvent(m, STORY_EVENTS)?.id).toBe('ch1-clean');
    m = storyComplete(m, 'ch1-clean');
    expect(nextAutoEvent(m, STORY_EVENTS)).toBeNull(); // 편지 해석은 터치해야 시작
    expect(interactEvent(m, STORY_EVENTS, 'letter')?.id).toBe('ch1-letter');
    expect(interactEvent(m, STORY_EVENTS, 'painting')).toBeNull(); // 순서 강제
  });
  it('퀴즈 기록: 오답 횟수 누적, 정답 후에는 고정', () => {
    let m = initialMansionState();
    m = recordQuiz(m, 'q-ch1-behind', false, at);
    m = recordQuiz(m, 'q-ch1-behind', true, at);
    m = recordQuiz(m, 'q-ch1-behind', false, at);
    expect(m.story.quizzes['q-ch1-behind']).toMatchObject({ solved: true, attempts: 2 });
  });
});
