/**
 * 장면 좌표계 — 시안 A v3 그림(1536×864) 픽셀 좌표를 그대로 쓴다.
 * (이전 아이소메트릭 그리드 API 이름은 유지: Grid = 장면 px, isoG = 항등 변환)
 */
export type Pt = [number, number];
export type Grid = [number, number];

export const WORLD: Pt = [1536, 864];
export const iso = (x: number, y: number): Pt => [x, y];
export const isoG = (g: Grid): Pt => [g[0], g[1]];
export const up = (p: Pt, h: number): Pt => [p[0], p[1] - h];
/** 이동 거리 (100px = 1) — 캐릭터 연출 속도 계산용 */
export const dist = (a: Grid, b: Grid) => Math.hypot(a[0] - b[0], a[1] - b[1]) / 100;
