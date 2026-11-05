import { memo, useState, type CSSProperties } from 'react';
import { anchorOf, assetUrl, hasAsset, heightFor } from '../assets';
import SPRITES from './sprites.json';
import { WORLD, type Pt } from './iso';

export interface SheetMeta { frameW: number; frameH: number; cols: number; rows: { action: string; frames: number }[]; foot: [number, number]; expressions?: string[] }
const SHEETS = SPRITES as unknown as Record<string, SheetMeta>;
export const sheetMeta = (key: string): SheetMeta | undefined => SHEETS[key];

const reported = new Set<string>();
export function reportMissing(key: string, why: string) {
  if (reported.has(key)) return;
  reported.add(key);
  console.error(`[mansion-asset] ${why}: ${key}`);
}

const pctX = (x: number) => `${(x / WORLD[0]) * 100}%`;
const pctY = (y: number) => `${(y / WORLD[1]) * 100}%`;

/** 월드 좌표의 정적 에셋 1개. at = 기준점(발밑 또는 중심) 월드 px */
export const WorldSprite = memo(function WorldSprite({ assetKey, at, width, z, center, skew, className, testId, style, layer = 'objects' }: {
  assetKey: string; at: Pt; width: number; z: number; center?: boolean; skew?: number; className?: string; testId?: string; style?: CSSProperties; layer?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ok = hasAsset(assetKey) && !failed;
  const h = ok ? heightFor(assetKey, width) : width * 0.8;
  const [ax, ay] = ok ? (center ? [0.5, 0.5] : anchorOf(assetKey)) : [0.5, center ? 0.5 : 1];
  const box: CSSProperties = { position: 'absolute', left: pctX(at[0] - width * ax), top: pctY(at[1] - h * ay), width: pctX(width), height: pctY(h), zIndex: z };
  const transform = skew ? `skewY(${skew}deg)` : undefined;
  if (!ok) {
    reportMissing(assetKey, failed ? 'load failed' : 'not in manifest');
    return <div data-testid={testId} data-asset={assetKey} data-layer={layer} data-placeholder="true" aria-hidden className="pointer-events-none rounded-xl border-2 border-dashed border-[#B98B5E] bg-[#FFF4E6]/80" style={{ ...box, transform, ...style }} />;
  }
  return (
    <img src={assetUrl(assetKey)} alt="" draggable={false} decoding="async" data-testid={testId} data-asset={assetKey} data-layer={layer} onError={() => setFailed(true)}
      className={`pointer-events-none select-none ${className ?? ''}`} style={{ ...box, transform, transformOrigin: center ? 'center' : 'center bottom', ...style }} />
  );
});

const DUR: Record<string, number> = { idle: 1.3, walk: 0.55, sweep: 0.75, paint: 0.85, repair: 0.6, celebrate: 0.8, sniff: 1 };

/** 스프라이트 시트 애니메이션 캐릭터. 행 = 동작, 열 = 프레임 (CSS steps) */
export function CharacterSprite({ sheet, action, facing, at, width, z, testId, label }: { sheet: string; action: string; facing: 'left' | 'right'; at: Pt; width: number; z: number; testId?: string; label?: string }) {
  const m = sheetMeta(sheet);
  if (!m || !hasAsset(sheet)) { reportMissing(sheet, 'sprite sheet missing'); return null; }
  let row = m.rows.findIndex((r) => r.action === action);
  if (row < 0) row = 0;
  const frames = m.rows[row].frames;
  const h = (width * m.frameH) / m.frameW;
  const footY = (m.foot[1] / m.frameH) * h;
  return (
    <div data-testid={testId} data-action={m.rows[row].action} data-facing={facing} data-layer="characters" aria-label={label} role={label ? 'img' : undefined}
      className="absolute pointer-events-none overflow-hidden"
      style={{ left: pctX(at[0] - width / 2), top: pctY(at[1] - footY), width: pctX(width), height: pctY(h), zIndex: z, transform: facing === 'left' ? 'scaleX(-1)' : undefined }}>
      <div key={`${action}`} className="absolute left-0 sprite-run" style={{ width: `${m.cols * 100}%`, height: `${m.rows.length * 100}%`, top: `${-row * 100}%`,
        ['--sx' as string]: `${(-frames / m.cols) * 100}%`, animationDuration: `${DUR[action] ?? 1}s`, animationTimingFunction: `steps(${frames})` }}>
        <img src={assetUrl(sheet)} alt="" draggable={false} className="w-full h-full select-none" />
      </div>
    </div>
  );
}

/** 대화 초상: 표정 = 시트의 열 */
export function Portrait({ sheet, expr, size, flip, className }: { sheet: string; expr: string; size: number | string; flip?: boolean; className?: string }) {
  const m = sheetMeta(sheet);
  if (!m) return null;
  const i = Math.max(0, m.expressions?.indexOf(expr) ?? 0);
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`} style={{ width: size, height: size, transform: flip ? 'scaleX(-1)' : undefined }} data-expr={m.expressions?.[i]} aria-hidden>
      <img src={assetUrl(sheet)} alt="" draggable={false} className="absolute top-0 h-full max-w-none" style={{ width: `${m.cols * 100}%`, left: `${-i * 100}%` }} />
    </div>
  );
}
