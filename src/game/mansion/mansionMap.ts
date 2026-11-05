/**
 * 전체 저택 맵 데이터 — Figma AI 생성 맵(46:4, 1536×864, art/figma-a/map) 위의 방 영역.
 * 거실 → 주방 → 침실 → 서재 → 욕실 → 정원 순서로 해금. 아직 구현되지 않은 공간은 '준비 중'으로만 표시한다.
 */
import type { MansionState } from '@/domain/mansion/types';
import { taskStatus } from '@/domain/mansion/logic';
import { LIVING_TASKS } from '@/content/mansion/tasks';

export type MapRoomId = 'living' | 'kitchen' | 'bedroom' | 'study' | 'bath' | 'garden';
export interface MapRoom {
  id: MapRoomId; name: string; chapter: string;
  poly: [number, number][];
  label: [number, number];
  clouds: [number, number, number, number][]; // [구름 번호, x, y, 너비]
  /** 앞 공간 */
  after?: MapRoomId;
  /** 실제로 들어갈 수 있는 화면이 있는지 */
  playable: boolean;
}

export const MAP_SIZE: [number, number] = [1536, 864];
export const MAP_ROOMS: MapRoom[] = [
  { id: 'living', name: '거실', chapter: 'CH.01', playable: true, label: [430, 330], clouds: [],
    poly: [[165, 410], [295, 230], [600, 258], [608, 415], [705, 420], [712, 545], [660, 560], [520, 580], [205, 525]] },
  { id: 'kitchen', name: '주방', chapter: 'CH.02', after: 'living', playable: false, label: [700, 330], clouds: [[2, 560, 250, 280], [5, 650, 300, 240]],
    poly: [[610, 285], [790, 300], [785, 410], [705, 420], [608, 415]] },
  { id: 'bedroom', name: '침실', chapter: 'CH.03', after: 'kitchen', playable: false, label: [450, 140], clouds: [[1, 250, 10, 360], [4, 380, 90, 300]],
    poly: [[300, 40], [600, 62], [600, 215], [540, 250], [300, 222]] },
  { id: 'study', name: '서재', chapter: 'CH.04', after: 'bedroom', playable: false, label: [720, 170], clouds: [[3, 560, 40, 330], [6, 650, 120, 280]],
    poly: [[600, 62], [850, 95], [840, 232], [800, 300], [600, 258]] },
  { id: 'bath', name: '욕실', chapter: 'CH.05', after: 'study', playable: false, label: [925, 200], clouds: [[2, 820, 70, 270], [6, 860, 170, 230]],
    poly: [[850, 95], [1030, 125], [1000, 312], [800, 300]] },
  { id: 'garden', name: '정원', chapter: 'CH.06', after: 'bath', playable: false, label: [1290, 450], clouds: [[1, 1050, 230, 330], [3, 1220, 350, 340], [5, 1080, 470, 330], [4, 1260, 190, 300], [6, 1200, 560, 320]],
    poly: [[1090, 215], [1505, 250], [1495, 700], [1110, 705], [1000, 640], [1010, 300]] },
];
export const MAP_ROOM_BY_ID = Object.fromEntries(MAP_ROOMS.map((r) => [r.id, r])) as Record<MapRoomId, MapRoom>;

/** 공간별 진행 (현재는 거실만 미션이 있음) */
export function roomProgress(m: MansionState, id: MapRoomId) {
  if (id !== 'living') return { done: 0, total: 0, complete: false };
  const done = LIVING_TASKS.filter((t) => taskStatus(m, t) === 'completed').length;
  return { done, total: LIVING_TASKS.length, complete: done === LIVING_TASKS.length };
}

/** 해금: 앞 공간을 완성하면 열린다 */
export function roomUnlocked(m: MansionState, id: MapRoomId): boolean {
  const r = MAP_ROOM_BY_ID[id];
  if (!r.after) return true;
  return roomUnlocked(m, r.after) && roomProgress(m, r.after).complete;
}
