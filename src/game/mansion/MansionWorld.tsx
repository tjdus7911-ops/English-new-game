/**
 * 저택 장면 — 확정 시안 A v3 그림을 바탕으로, 아직 끝나지 않은 미션의 '이전 상태' 레이어를 겹쳐 보여 준다.
 * 레이어는 Figma 리모델링 단계 보드(38:2)와 같은 위치·같은 모양 (scene.json). 미션을 마치면 해당 레이어가 사라진다.
 * 캐릭터(하루·오브리·호두)는 v3 그림 속에 그려져 있고, 대화는 초상으로 진행한다.
 */
import type { ReactNode } from 'react';
import type { MansionState, RenovationTask } from '@/domain/mansion/types';
import { resolveVariant, taskStatus } from '@/domain/mansion/logic';
import { LIVING_TASKS, LIVING_TASK_BY_ID } from '@/content/mansion/tasks';
import { assetUrl, heightFor } from '../assets';
import { WORLD, type Grid, type Pt } from './iso';
import { INTERACTABLES, PROP_SPOTS, ROOM_BY_ID, ROOM_LABELS, SLOTS, type Cond } from './mapData';
import SCENE from './scene.json';

export interface CharState { id: string; at: Grid; facing: 'left' | 'right'; action: string }
export interface Visual {
  /** 연출 중인 작업 — 저장은 끝났지만 화면은 아직 이전 상태로 보여 준다 */
  pendingTask: string | null;
  /** 0..1 진행도 (이전 상태 레이어가 이만큼 사라짐) */
  progress: number;
  removedOld: boolean;
  installed: boolean;
  preview: { taskId: string; variantId: string } | null;
  props: Record<string, { at: Grid; h?: number; width: number; assetKey: string }>;
  fx: { id: number; kind: 'sparkle' | 'dust' | 'get'; at: Pt }[];
  shake: string | null;
}
export const initialVisual = (): Visual => ({ pendingTask: null, progress: 1, removedOld: false, installed: false, preview: null, props: {}, fx: [], shake: null });

interface Piece { key: string; x: number; y: number; w: number; h: number }
const S = SCENE as unknown as { size: [number, number]; base: string; layers: (Piece & { task: string; figma?: string })[]; variants: Record<string, Record<string, Piece>>; deps?: Record<string, string[]> };
const W = WORLD;
const pct = (x: number, y: number, w: number, h: number) => ({ left: `${(x / W[0]) * 100}%`, top: `${(y / W[1]) * 100}%`, width: `${(w / W[0]) * 100}%`, height: `${(h / W[1]) * 100}%` });
const at = (p: Pt) => ({ left: `${(p[0] / W[0]) * 100}%`, top: `${(p[1] / W[1]) * 100}%` });
const ORDER = LIVING_TASKS.map((t) => t.id);

export function condOk(c: Cond | undefined, isDone: (t: string) => boolean, m: MansionState) {
  if (!c) return true;
  const ev = (id: string) => m.story.completedEvents.includes(id);
  return (c.tasksDone ?? []).every(isDone) && !(c.tasksNotDone ?? []).some(isDone) && (c.eventsDone ?? []).every(ev) && !(c.eventsNotDone ?? []).some(ev);
}

/** 변형 조각: 원본(v3 그대로인 선택지)이면 null. 추가형(거울 등)은 첫 선택지도 조각이 있다 */
/** depParts: 바탕 작업(벽·테이블·안락의자 등)의 현재 디자인 ('_' = 원본) — 그 조합에 맞춰 구운 조각이 있으면 그것을 쓴다 */
function variantPiece(t: RenovationTask, variantId: string | undefined, depParts: string[] = []): Piece | null {
  const v = t.variants?.find((x) => x.id === variantId);
  if (!v || v.assetKey === 'scene/v3') return null;
  const vs = S.variants[t.id];
  const combo = depParts.some((p) => p !== '_') ? vs?.[`${v.id}@${depParts.join('+')}`] : undefined;
  return combo || vs?.[v.id] || null;
}

function Img({ p, opacity, testId, className }: { p: Piece; opacity?: number; testId?: string; className?: string }) {
  return <img src={assetUrl(p.key)} alt="" draggable={false} decoding="async" data-testid={testId} data-asset={p.key} className={`absolute pointer-events-none select-none ${className ?? ''}`} style={{ ...pct(p.x, p.y, p.w, p.h), opacity }} />;
}

/** 시안 A 소품(조명·장식)을 발밑 기준으로 세움 */
function Prop({ assetKey, spot, opacity, testId, className }: { assetKey: string; spot: { at: Grid; height: number }; opacity?: number; testId?: string; className?: string }) {
  const h = spot.height, w = (h * h) / Math.max(1, heightFor(assetKey, h));
  return <img src={assetUrl(assetKey)} alt="" draggable={false} data-testid={testId} data-asset={assetKey} className={`absolute pointer-events-none select-none ${className ?? ''}`} style={{ ...pct(spot.at[0] - w / 2, spot.at[1] - h, w, h), opacity, filter: 'drop-shadow(0 6px 6px rgba(40,25,10,.35))' }} />;
}

export function MansionWorld({ mansion, visual, onHotspot, onInteract, onRoomLabel, onEdit, interactive, editMode, busy }: {
  mansion: MansionState; visual: Visual; chars?: CharState[];
  onHotspot?: (taskId: string) => void; onInteract?: (id: string) => void; onRoomLabel?: (room: string) => void; onEdit?: (taskId: string) => void;
  interactive: boolean; editMode?: boolean; busy?: boolean;
}) {
  const pending = visual.pendingTask;
  const isDone = (id: string) => taskStatus(mansion, LIVING_TASK_BY_ID[id]) === 'completed' && pending !== id;
  const chosen = (t: RenovationTask) => (visual.preview?.taskId === t.id ? visual.preview.variantId : mansion.renovations[t.id]?.selectedVariantId);

  const layers: ReactNode[] = [];
  // 1) 완료(또는 미리보기·설치 중)인 미션의 선택 결과 — 색상 변형 조각
  for (const t of LIVING_TASKS) {
    if (!t.variants || PROP_SPOTS[t.id]) continue;
    const previewing = visual.preview?.taskId === t.id;
    const installing = pending === t.id;
    if (!previewing && !installing && !isDone(t.id)) continue;
    const depParts = (S.deps?.[t.id] ?? []).map((d) => {
      const dt = LIVING_TASK_BY_ID[d];
      if (!isDone(d) && visual.preview?.taskId !== d) return '_';
      const cv = dt.variants?.find((x) => x.id === chosen(dt));
      return cv && cv.assetKey !== 'scene/v3' ? cv.id : '_';
    });
    const p = variantPiece(t, chosen(t), depParts);
    if (p) layers.push(<Img key={`v-${t.id}`} p={p} testId={`variant-layer-${t.id}`} opacity={installing && !previewing ? visual.progress : 1} className={previewing ? 'mansion-preview' : ''} />);
  }
  // 2) 아직 끝나지 않은 미션의 이전 상태 레이어 (나중 미션이 아래, 앞선 미션이 위)
  for (const id of [...ORDER].reverse()) {
    if (isDone(id) || visual.preview?.taskId === id) continue;
    const fading = pending === id;
    const ls = S.layers.filter((l) => l.task === id);
    if (!ls.length) continue;
    layers.push(<div key={`pre-${id}`} data-testid={`pre-${id}`} className="absolute inset-0 pointer-events-none" style={{ opacity: fading ? 1 - visual.progress : 1, transition: fading ? 'none' : undefined }}>{ls.map((l) => <Img key={l.key} p={l} />)}</div>);
  }
  // 3) 새로 세우는 소품: 스탠드(D25)·화분(E33)
  for (const t of LIVING_TASKS) {
    if (!PROP_SPOTS[t.id]) continue;
    const previewing = visual.preview?.taskId === t.id;
    const installing = pending === t.id && visual.installed;
    if (!previewing && !installing && !isDone(t.id)) continue;
    const v = resolveVariant(mansion, t, visual.preview);
    if (v) layers.push(<Prop key={`prop-${t.id}`} assetKey={v.assetKey} spot={PROP_SPOTS[t.id]} testId={`furniture-${t.id}`} className={previewing ? 'mansion-preview' : installing ? 'prop-pop' : ''} />);
  }
  // 4) 스토리 소품 (편지·열쇠·사진 등)
  for (const [id, pr] of Object.entries(visual.props)) {
    const h = heightFor(pr.assetKey, pr.width);
    layers.push(<img key={`sp-${id}`} src={assetUrl(pr.assetKey)} alt="" data-testid={`prop-${id}`} className="absolute pointer-events-none prop-pop" style={{ ...pct(pr.at[0] - pr.width / 2, pr.at[1] - (pr.h ?? 0) - h / 2, pr.width, h), filter: 'drop-shadow(0 4px 6px rgba(40,25,10,.5))' }} />);
  }

  // 핫스팟 (카메라 배율과 무관하게 44px 이상: --inv 로 역보정)
  const hot: ReactNode[] = [];
  const kitchenUnlocked = LIVING_TASKS.every((t) => isDone(t.id));
  // 디자인 준비 중(ready:false) 작업은 핫스팟을 띄우지 않는다 (taskStatus 가 locked)
  if (interactive && !busy) {
    for (const t of LIVING_TASKS) {
      const st = taskStatus(mansion, t);
      const s = SLOTS[t.slot];
      if (!s) continue;
      if (st === 'available' && (!editMode || t.variants?.length)) {
        hot.push(<button key={t.id} type="button" data-testid={`hotspot-${t.id}`} onClick={() => onHotspot?.(t.id)} aria-label={`${t.title} 미션 · 별 ${t.costStars}개`}
          className="absolute cam-hot grid place-items-center w-14 h-14 rounded-full bg-[#F3D58C] text-[#5A3500] text-2xl font-black border-4 border-[#FFF3D6] shadow-lg hotspot-ring" style={at(s.at)}>!</button>);
      }
      if (editMode && st === 'completed' && t.variants?.length) {
        hot.push(<button key={`e-${t.id}`} type="button" data-testid={`edit-${t.id}`} onClick={() => onEdit?.(t.id)} aria-label={`${t.title} 스타일 바꾸기 (무료)`}
          className="absolute cam-hot grid place-items-center w-12 h-12 rounded-full bg-[#FBF3E2] text-[#6B4A2E] text-xl font-black border-4 border-[#C9A46A] shadow-lg" style={at(s.at)}>✎</button>);
      }
    }
    for (const it of INTERACTABLES) {
      if (!condOk(it.when, isDone, mansion) || editMode) continue;
      if (it.assetKey) layers.push(<img key={`it-${it.id}`} src={assetUrl(it.assetKey)} alt="" data-testid={`interact-obj-${it.id}`} className="absolute pointer-events-none interact-glow" style={pct(it.at[0] - (it.width ?? 56) / 2, it.at[1] - (it.width ?? 56) / 2, it.width ?? 56, heightFor(it.assetKey, it.width ?? 56))} />);
      hot.push(<button key={`i-${it.id}`} type="button" data-testid={`interact-${it.id}`} onClick={() => onInteract?.(it.id)} aria-label={`${it.label} 살펴보기`}
        className="absolute cam-hot grid place-items-center w-14 h-14 rounded-full bg-[#FBF3E2] border-4 border-[#C9A46A] shadow-lg hotspot-ring" style={at([it.at[0], it.at[1] + 20])}><img src={assetUrl('a/icon-magnifier')} alt="" aria-hidden className="w-9 h-9 a-icon" draggable={false} /></button>);
    }
    if (!editMode) for (const l of ROOM_LABELS) {
      const r = ROOM_BY_ID[l.room];
      const opened = l.room === 'kitchen' && kitchenUnlocked;
      hot.push(<button key={`r-${l.room}`} type="button" data-testid={`room-${l.room}`} data-unlocked={opened ? '1' : '0'} onClick={() => onRoomLabel?.(l.room)} aria-label={opened ? `${r.name} — 해금됨, 이야기 준비 중` : `${r.name} — ${r.locked?.chapter} 잠김`}
        className="absolute cam-hot mansion-chip rounded-2xl px-3 min-h-[44px] flex items-center gap-1.5 text-sm font-bold text-[#6B4A2E] whitespace-nowrap" style={at(l.at)}>{opened ? '🔓' : '🔒'} {r.name}<span className="text-[11px] font-semibold text-[#A0835F]">{opened ? '준비 중' : r.locked?.chapter}</span></button>);
    }
  }

  const sel = (id: string) => (isDone(id) ? mansion.renovations[id]?.selectedVariantId ?? 'done' : 'old');
  return (
    <div className="absolute inset-0" data-testid="mansion-world" data-cleaned={isDone('A1') ? '1' : '0'} data-wall={sel('B8')} data-floor={sel('B9')} data-sofa={sel('C15')}
      data-done={LIVING_TASKS.filter((t) => isDone(t.id)).length}>
      <img src={assetUrl(S.base)} alt="하루가 물려받은 저택의 거실" draggable={false} className="absolute inset-0 w-full h-full select-none pointer-events-none" data-testid="scene-base" />
      <div className={`absolute inset-0 pointer-events-none ${visual.shake ? 'obj-shake' : ''}`} data-layer="objects">{layers}</div>
      <div className="absolute inset-0 pointer-events-none overflow-hidden" data-layer="fx">{visual.fx.map((f) => <Fx key={f.id} kind={f.kind} at={f.at} />)}</div>
      <div className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto" data-layer="hotspots">{hot}</div>
    </div>
  );
}

function Fx({ kind, at }: { kind: 'sparkle' | 'dust' | 'get'; at: Pt }) {
  const pos = { left: `${(at[0] / W[0]) * 100}%`, top: `${(at[1] / W[1]) * 100}%` };
  if (kind === 'get') return <div className="fx-get" style={pos} />;
  const n = kind === 'dust' ? 7 : 9;
  return (
    <>{Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = kind === 'dust' ? 40 + (i % 3) * 30 : 60 + (i % 2) * 50;
      return kind === 'dust'
        ? <div key={i} className="fx-dust" style={{ ...pos, width: 60 + (i % 3) * 30, height: 40 + (i % 3) * 20, ['--dx' as string]: `${Math.cos(a) * r}px`, animationDelay: `${i * 0.08}s`, marginLeft: Math.cos(a) * 30, marginTop: Math.sin(a) * 12 }} />
        : <div key={i} className="fx-spark" style={{ ...pos, ['--dx' as string]: `${Math.cos(a) * r}px`, ['--dy' as string]: `${Math.sin(a) * r * 0.7 - 40}px`, animationDelay: `${i * 0.05}s` }} />;
    })}</>
  );
}

