/**
 * 펫 한 마리 그리기 — 현재 모션의 키포즈를 아틀라스에서 잘라 그리고, 모션의 절차적 트랙(숨쉬기·걷기 등)을 CSS 로 얹는다.
 * 위치(left/top)는 '발밑' 기준. height = 이 펫·단계의 idle 포즈가 화면에 보일 높이(px).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { MOTIONS, type MotionId } from '../data/motions';
import type { StageNo } from '../data/species';
import { frameOf, petUrl, stageAtlas } from './atlas';

export function useMotionFrame(motion: MotionId, startedAt = 0) {
  const def = MOTIONS[motion];
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (def.frames.length < 2) return;
    const ms = 1000 / (def.fps ?? 1);
    const t = setInterval(() => setI((x) => Math.min(def.frames.length - 1, x + 1)), ms);
    return () => clearInterval(t);
  }, [motion, startedAt, def]);
  return def.frames[Math.min(i, def.frames.length - 1)];
}

export function PetFrame({ slug, stage, frame, height, style, className }: { slug: string; stage: StageNo; frame: string; height: number; style?: CSSProperties; className?: string }) {
  const sa = stageAtlas(slug, stage);
  const idle = sa.frames.idle;
  const f = frameOf(slug, stage, frame);
  const s = height / idle.h;
  return (
    <div className={className} style={{
      position: 'absolute', width: f.w * s, height: f.h * s, left: -f.anchor[0] * f.w * s, top: -f.anchor[1] * f.h * s,
      backgroundImage: `url(${petUrl(sa.atlas)})`, backgroundSize: `${sa.size[0] * s}px ${sa.size[1] * s}px`,
      backgroundPosition: `${-f.x * s}px ${-f.y * s}px`, backgroundRepeat: 'no-repeat', ...style,
    }} />
  );
}

/** 정적 이미지(카드·도감 등): 박스 안에 맞춰 그림 */
export function PetPortrait({ slug, stage, frame = 'idle', box, silhouette, className }: { slug: string; stage: StageNo; frame?: string; box: number; silhouette?: boolean; className?: string }) {
  const sa = stageAtlas(slug, stage);
  const f = frameOf(slug, stage, frame);
  const s = Math.min(box / f.w, box / f.h);
  return (
    <div className={className} style={{ width: box, height: box, position: 'relative', display: 'grid', placeItems: 'center' }}>
      <div style={{
        width: f.w * s, height: f.h * s, backgroundImage: `url(${petUrl(sa.atlas)})`, backgroundSize: `${sa.size[0] * s}px ${sa.size[1] * s}px`,
        backgroundPosition: `${-f.x * s}px ${-f.y * s}px`, filter: silhouette ? 'brightness(0) opacity(.55)' : undefined,
      }} />
    </div>
  );
}

const BUBBLE: Record<string, string> = { happy: '♪', sad: '💧', love: '♥', sleepy: '…', curious: '?', surprise: '!', excited: '✦', angry: '💢', shy: '///', zzz: 'Zzz' };

/** 움직이는 펫: 모션 트랙 + 좌우 반전 + 감정 말풍선 */
export function PetActor({ slug, stage, motion, startedAt, height, x, y, facing, onTap, z, label }: {
  slug: string; stage: StageNo; motion: MotionId; startedAt?: number; height: number; x: number; y: number; facing: 1 | -1;
  onTap?: () => void; z?: number; label?: string;
}) {
  const def = MOTIONS[motion];
  const frame = useMotionFrame(motion, startedAt);
  const bubble = def.bubble ? BUBBLE[def.bubble] : null;
  return (
    <div className="pet-actor" style={{ left: x, top: y, zIndex: z ?? Math.round(y) }} data-motion={motion} aria-label={label}>
      <div className="pet-shadow" style={{ width: height * 0.7, height: height * 0.12, left: -height * 0.35, top: -height * 0.06 }} />
      <div className={`pet-track trk-${def.track}`} key={`${motion}-${startedAt}`}>
        <div style={{ transform: `scaleX(${facing})`, position: 'absolute' }}>
          <PetFrame slug={slug} stage={stage} frame={frame} height={height} className="pet-frame" />
        </div>
      </div>
      {onTap && <button type="button" className="pet-hit" onClick={onTap} aria-label={label ?? '펫'} style={{ width: height * 0.8, height: height * 0.95, left: -height * 0.4, top: -height * 0.95 }} />}
      {bubble && <div className="pet-bubble" key={`b-${motion}-${startedAt}`} style={{ top: -height * 1.08, fontSize: Math.max(18, Math.min(30, height * 0.22)) }}>{bubble}</div>}
    </div>
  );
}
