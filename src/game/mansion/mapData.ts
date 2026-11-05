/**
 * 저택 장면 데이터 — 시안 A v3 그림(1536×864) 위의 위치. 모든 좌표는 그림 픽셀.
 * 미션 이전 상태 레이어는 scene.json (scripts/mansion-art/bake_scene.py 가 Figma STEP 0~3 에서 생성).
 */
import type { Grid } from './iso';
import { LIVING_OBJECTS } from '@/content/mansion/objects';

export type RoomId = 'living' | 'kitchen' | 'hall' | 'porch' | 'garden';
export interface Cond { tasksDone?: string[]; tasksNotDone?: string[]; eventsDone?: string[]; eventsNotDone?: string[] }

export interface Room { id: RoomId; name: string; locked?: { chapter: string; label: string } }
export const ROOMS: Room[] = [
  { id: 'living', name: '거실' },
  { id: 'kitchen', name: '주방', locked: { chapter: 'CH.02', label: '주방 · 레시피와 암호' } },
  { id: 'hall', name: '복도 · 계단', locked: { chapter: 'CH.06', label: '복도 · 2층으로 가는 계단' } },
  { id: 'garden', name: '정원', locked: { chapter: 'CH.05', label: '정원 · 땅속의 수상한 상자' } },
  { id: 'porch', name: '현관' },
];
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, Room>;

/** 작업(task id) → 핫스팟·작업 연출 위치. 기본은 오브젝트 사각형 중심, 큰 면(벽·바닥)·겹치는 자리는 따로 지정 */
const HOT: Record<string, Grid> = {
  A1: [1045, 585], A2: [925, 440], A3: [465, 60], A4: [1230, 540], A5: [700, 420], A6: [548, 160], A7: [325, 400],
  B8: [230, 260], B9: [960, 720], B12: [325, 345], C15: [610, 470], C16: [345, 640], C17: [525, 760], C18: [745, 590],
  D23: [700, 70], D25: [858, 400], D26: [620, 230], D27: [880, 650], E33: [995, 505],
  B10: [600, 70], B11: [240, 45], B13: [1400, 380], B14: [70, 430], D24: [228, 200], D28: [700, 450],
  E29: [310, 145], E30: [331, 226], E31: [391, 182], E32: [754, 532], E34: [360, 668], E35: [702, 588],
  E36: [255, 248], E37: [781, 70], E38: [294, 244], E39: [652, 584], E40: [658, 784],
  C19: [440, 600], C20: [731, 120], C21: [935, 300], C22: [1400, 168],
};
export const SLOTS: Record<string, { at: Grid }> = Object.fromEntries(LIVING_OBJECTS.map((o) => {
  const [x, y, w, h] = o.rect;
  return [o.taskId, { at: HOT[o.taskId] ?? [Math.round(x + w / 2), Math.round(y + h / 2)] }];
}));

/** 소품을 새로 세우는 작업 (스탠드 D25 · 화분 E33): 발밑 기준, 표시 높이 */
export const PROP_SPOTS: Record<string, { at: Grid; height: number }> = {
  D25: { at: [858, 470], height: 150 },
  E33: { at: [995, 545], height: 120 },
};

/** 카메라 포커스 (그림 px, zoom = 기본 배율 대비) */
export const FOCUS: Record<string, { at: Grid; h?: number; zoom?: number }> = {
  default: { at: [768, 432], zoom: 1 },
  living: { at: [700, 470], zoom: 1 },
  porch: { at: [150, 430], zoom: 1.3 },
  letter: { at: [640, 640], zoom: 1.8 },
  painting: { at: [310, 150], zoom: 1.8 },
  wall: { at: [230, 260], zoom: 1.6 },
  armchair: { at: [520, 700], zoom: 1.6 },
  kitchen: { at: [900, 120], zoom: 1.5 },
  hall: { at: [1340, 330], zoom: 1.4 },
  garden: { at: [60, 420], zoom: 1.4 },
  finish: { at: [700, 470], zoom: 1 },
  floor: { at: [960, 720], zoom: 1.35 },
  ...Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, { at: v.at, zoom: 1.45 }])),
};

/** 캐릭터 지점 — v3 그림 속 인물 위치 (연출용 좌표, 캐릭터는 그림에 그려져 있음) */
export const SPOTS: Record<string, Grid> = {
  'haru-home': [575, 420], 'aubrey-home': [705, 390], 'hodu-home': [565, 700],
  'porch-door': [70, 450], 'porch-aubrey': [140, 520], 'porch-haru': [190, 560],
  'by-sofa': [640, 640], 'by-sofa-cat': [620, 650], 'by-painting': [330, 330], 'by-painting-haru': [380, 400],
  'by-wall': [230, 420], 'by-armchair': [540, 760], center: [760, 560],
};

/** 상호작용 오브젝트 (스토리) */
export const INTERACTABLES: { id: string; label: string; focus: string; at: Grid; h: number; when: Cond; eventId: string; assetKey?: string; width?: number }[] = [
  { id: 'letter', label: '오래된 편지', focus: 'letter', at: [640, 650], h: 0, when: { eventsDone: ['ch1-clean'], eventsNotDone: ['ch1-letter'] }, eventId: 'ch1-letter', assetKey: 'a/icon-envelope', width: 56 },
  { id: 'painting', label: '벽에 걸린 그림', focus: 'painting', at: [318, 150], h: 0, when: { eventsDone: ['ch1-letter'], eventsNotDone: ['ch1-key'] }, eventId: 'ch1-key' },
];

/** 잠긴 공간 안내 칩 */
export const ROOM_LABELS: { room: RoomId; at: Grid; h: number }[] = [
  { room: 'kitchen', at: [905, 160], h: 0 },
  { room: 'hall', at: [1360, 240], h: 0 },
  { room: 'garden', at: [62, 300], h: 0 },
];
