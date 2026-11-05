/** 스토리 트리거·진행도 (순수 함수) */
import type { MansionState } from '@/domain/mansion/types';
import type { Chapter, StoryEvent } from './types';

const done = (m: MansionState, id: string) => m.story.completedEvents.includes(id);
const ready = (m: MansionState, e: StoryEvent) => !done(m, e.id) && (e.requires ?? []).every((r) => done(m, r));

/**
 * 지금 자동으로 재생해야 할 이벤트.
 * 1) 진행 중이던 이벤트(앱 종료 등으로 끊김) → 처음부터 다시
 * 2) 첫 입장(enterMansion)
 * 3) 완료된 미션에 연결된 이벤트(미션 확정 후 연출 도중 종료된 경우 포함)
 * interact 트리거는 플레이어가 오브젝트를 눌러야 시작하므로 제외
 */
export function nextAutoEvent(m: MansionState, events: StoryEvent[]): StoryEvent | null {
  if (m.story.currentEventId) {
    const cur = events.find((e) => e.id === m.story.currentEventId);
    if (cur && !done(m, cur.id)) return cur;
  }
  for (const e of events) {
    if (!ready(m, e)) continue;
    if (e.trigger.type === 'enterMansion') return e;
    if (e.trigger.type === 'taskCompleted' && m.renovations[e.trigger.taskId]?.status === 'completed') return e;
    if (e.trigger.type === 'allTasksCompleted' && e.trigger.taskIds.every((id) => m.renovations[id]?.status === 'completed')) return e;
  }
  return null;
}

export function interactEvent(m: MansionState, events: StoryEvent[], objectId: string): StoryEvent | null {
  return events.find((e) => e.trigger.type === 'interact' && e.trigger.objectId === objectId && ready(m, e)) ?? null;
}

export function chapterState(m: MansionState, ch: Chapter, events: StoryEvent[]) {
  const unlocked = ch.unlock.eventsDone.every((id) => done(m, id));
  const evs = events.filter((e) => e.chapter === ch.id);
  const completed = evs.filter((e) => done(m, e.id)).length;
  return { unlocked, playable: unlocked && ch.available, completed, total: evs.length };
}
