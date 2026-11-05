/** 미션 작업 연출 · 스토리 이벤트 실행기 */
import type { RenovationTask } from '@/domain/mansion/types';
import type { StoryEvent } from '@/domain/story/types';
import { CHARACTERS } from '@/content/story/characters';
import { FOCUS, SLOTS, SPOTS } from '@/game/mansion/mapData';
import type { Director } from './useDirector';
import { sfx } from '@/lib/sfx';

/** 0→1 진행도 애니메이션 (visual.progress) */
async function progress(d: Director, ms: number) {
  if (d.skipping()) { d.setVisual((v) => ({ ...v, progress: 1 })); return; }
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    d.setVisual((v) => ({ ...v, progress: i / steps }));
    await d.sleep(ms / steps);
    if (d.skipping()) break;
  }
  d.setVisual((v) => ({ ...v, progress: 1 }));
}

/**
 * 미션 작업 연출 — 호출 전에 별 차감·미션 완료가 이미 저장되어 있어야 한다.
 * 연출 중에는 visual.pendingTask 로 이전 모습을 보여 주다가 단계별로 바꾼다. 건너뛰거나 중단돼도 저장 상태는 이미 최종.
 */
export async function runMissionAnimation(d: Director, task: RenovationTask) {
  const w = task.work;
  const spot = SLOTS[task.slot]?.at ?? FOCUS.living.at;
  d.beginSkippable();
  d.setVisual((v) => ({ ...v, pendingTask: task.id, progress: 0, removedOld: false, installed: false, preview: null }));
  try {
    await d.cam(task.slot, 1.45, 700);
    // v3 그림 속 오브리가 작업하는 동안: 먼지·망치·롤러 효과와 함께 이전 상태 레이어가 서서히 사라짐
    const dust = w.anim === 'clean' || w.anim === 'repair';
    for (let i = 0; i < 3; i++) { sfx(w.anim === 'repair' ? 'hammer' : 'work'); d.fx(dust ? 'dust' : 'sparkle', [spot[0] + (i - 1) * 40, spot[1] + (i % 2) * 18], 0); await d.sleep(380); }
    if (w.anim === 'install' || w.anim === 'finish') d.setVisual((v) => ({ ...v, removedOld: true, installed: true }));
    await progress(d, 2000);
    d.fx('sparkle', spot, 30);
    sfx('complete');
    await d.sleep(900);
  } finally {
    d.setVisual((v) => ({ ...v, pendingTask: null, progress: 1, removedOld: false, installed: false }));
    d.endSkippable();
  }
}

export interface StoryCommit {
  begin: (id: string) => void;
  grantClue: (clueId: string, eventId: string) => void;
  finish: (id: string) => void;
}

/**
 * 스토리 이벤트 실행. replay=true 면 저장 상태를 바꾸지 않는다(다시보기).
 * 시작 시 currentEventId 를 저장 → 도중 종료 시 다음 입장 때 처음부터 다시 재생. 단서·퀴즈 결과는 단계마다 즉시 저장(멱등).
 */
export async function runStoryEvent(d: Director, ev: StoryEvent, commit: StoryCommit, opts: { replay?: boolean } = {}) {
  if (!opts.replay) commit.begin(ev.id);
  d.beginSkippable();
  try {
    for (const st of ev.steps) {
      switch (st.t) {
        case 'say': await d.say({ who: st.who, expr: st.expr ?? 'normal', text: st.text }); break;
        case 'narrate': await d.say({ who: null, expr: 'normal', text: st.text }); break;
        case 'move': { const p = d.move(st.who, SPOTS[st.to]); if (st.wait !== false) await p; break; }
        case 'place': d.place(st.who, SPOTS[st.at]); break;
        case 'face': d.face(st.who, st.dir); break;
        case 'act': { const p = d.act(st.who, CHARACTERS[st.who].actions.includes(st.action) ? st.action : 'idle', st.ms); if (st.wait !== false) await p; break; }
        case 'camera': await d.cam(st.focus, st.zoom, st.ms); break;
        case 'cameraReset': await d.camReset(); break;
        case 'shake': sfx('tap'); await d.shake(st.target); break;
        case 'reveal': d.setVisual((v) => ({ ...v, props: { ...v.props, [st.prop]: { at: st.at, h: st.h, width: st.width, assetKey: st.assetKey } } })); sfx('reveal'); await d.sleep(500); break;
        case 'hideProp': d.setVisual((v) => { const props = { ...v.props }; delete props[st.prop]; return { ...v, props }; }); break;
        case 'fx': d.fx(st.kind, st.at, st.h); break;
        case 'wait': await d.sleep(st.ms); break;
        case 'quiz': await d.showQuiz(st.id, !!opts.replay); break;
        case 'clue': {
          if (!opts.replay) commit.grantClue(st.id, ev.id);
          sfx('clue');
          await d.showClue(st.id);
          break;
        }
      }
    }
    if (!opts.replay) commit.finish(ev.id);
  } finally {
    d.setVisual((v) => ({ ...v, props: {}, shake: null }));
    d.endSkippable();
  }
}
