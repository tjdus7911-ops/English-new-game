/** 펫 아틀라스 접근 — build_pet_assets.py 가 만든 atlas.json */
import ATLAS from './generated/atlas.json';
import type { StageNo } from '../data/species';

export interface Frame { x: number; y: number; w: number; h: number; anchor: [number, number]; opaque?: boolean }
interface StageAtlas { atlas: string; size: [number, number]; frames: Record<string, Frame> }
interface PetAtlas { stages: Record<'s1' | 's2' | 's3', StageAtlas>; lineup: { file: string; size: [number, number] } }
interface AtlasFile {
  pets: Record<string, PetAtlas>;
  eggs: Record<string, { file: string; size: [number, number]; anchor: [number, number] }>;
  extra: { fire_fox: { evolution_s2_s3: { id: string; file: string }[] } };
}
const A = ATLAS as unknown as AtlasFile;

export const BASE = `${import.meta.env.BASE_URL}assets/`;
export const petUrl = (rel: string) => `${BASE}pets/${rel}`;
export const uiUrl = (rel: string) => `${BASE}ui/${rel}`;

export function stageAtlas(slug: string, stage: StageNo): StageAtlas {
  return A.pets[slug].stages[`s${stage}` as 's1'];
}
export function frameOf(slug: string, stage: StageNo, name: string): Frame {
  const s = stageAtlas(slug, stage);
  return s.frames[name] ?? s.frames.idle;
}
export const eggUrl = (attr: string) => petUrl(A.eggs[attr].file);
export const lineupUrl = (slug: string) => petUrl(A.pets[slug].lineup.file);
export const foxEvolution = () => A.extra.fire_fox.evolution_s2_s3.map((e) => petUrl(e.file));

/** 화면에 나올 펫의 아틀라스를 미리 받아 둔다 */
const loaded = new Map<string, Promise<void>>();
export function preloadAtlas(slug: string, stage: StageNo) {
  const url = petUrl(stageAtlas(slug, stage).atlas);
  if (!loaded.has(url)) loaded.set(url, new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = url; }));
  return loaded.get(url)!;
}

/**
 * 펫의 실제 렌더링 범위 — idle 높이(=표시 높이)를 1 로 했을 때, 모든 모션 프레임이 발밑 기준으로 차지하는 왼쪽·오른쪽·위쪽 최대 길이.
 * 화면 안전 영역·이동 가능 범위·크기 보정 계산에 쓴다 (날개·꼬리·뿔이 긴 펫은 값이 커진다).
 */
export function petExtent(slug: string, stage: StageNo): { side: number; top: number } {
  const sa = stageAtlas(slug, stage);
  const ih = sa.frames.idle.h;
  let side = 0, top = 0;
  for (const f of Object.values(sa.frames)) {
    side = Math.max(side, (f.w * Math.max(f.anchor[0], 1 - f.anchor[0])) / ih);
    top = Math.max(top, (f.h * f.anchor[1]) / ih);
  }
  return { side, top };
}
