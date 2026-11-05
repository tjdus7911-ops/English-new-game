/** 학습 진행률에 따라 달라지는 알 — 부화 화면·펫 하우스가 같이 쓴다 (시간 경과가 아니라 쌓인 학습량으로만 변함) */
import { Bar } from '../ui/kit';
import { eggUrl } from '../pets/atlas';
import { ATTRIBUTE_BY_ID } from '../data/species';
import { isReady, type Egg } from '../data/store';

export type EggLevel = 'calm' | 'wiggle' | 'crack' | 'ready';
export const eggLevel = (e: Egg): EggLevel => {
  const r = e.studyMin / e.needMin;
  return isReady(e) ? 'ready' : r >= 0.67 ? 'crack' : r >= 0.34 ? 'wiggle' : 'calm';
};
const GLOW = { calm: 18, wiggle: 30, crack: 42, ready: 70 } as const;

export function EggCracks({ k = 1 }: { k?: number }) {
  return (
    <svg viewBox="0 0 100 130" className="crack static" style={{ width: 330 * k, height: 420 * k }} aria-hidden>
      <path d="M50 18 L44 34 L54 44 L42 58 L56 70 L46 84" />
      <path d="M54 44 L66 50 L62 60" /><path d="M42 58 L32 62" />
    </svg>
  );
}

export function EggStage({ egg, height = 420, cx = 768, bottom = 640, showBar = true, onClick }: { egg: Egg; height?: number; cx?: number; bottom?: number; showBar?: boolean; onClick?: () => void }) {
  const A = ATTRIBUTE_BY_ID[egg.attr];
  const lv = eggLevel(egg);
  const ready = lv === 'ready';
  const remain = Math.max(0, egg.needMin - egg.studyMin);
  const cls = lv === 'calm' ? 'float' : lv === 'wiggle' ? 'egg-rock' : lv === 'crack' ? 'egg-rock fast' : 'egg-shake-hard egg-ready';
  const sparks = lv === 'calm' ? 3 : lv === 'wiggle' ? 5 : 8;
  return (
    <>
      <div style={{ position: 'absolute', left: cx - 260, top: bottom - 70, width: 520, height: 130, borderRadius: '50%', background: `radial-gradient(${A.color}AA, ${A.color}00 70%)`, filter: 'blur(4px)' }} />
      {Array.from({ length: sparks }, (_, i) => (
        <span key={i} className="egg-spark" style={{ left: cx + Math.cos(i * 2.4) * height * 0.42, top: bottom - height * (0.15 + ((i * 37) % 70) / 100), color: A.color, animationDelay: `${i * 0.35}s` }}>✦</span>
      ))}
      <div className={`hatch-egg ${cls}`} style={{ left: cx, top: bottom, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick} data-testid="egg" data-level={lv}>
        <img src={eggUrl(egg.attr)} alt={`${A.nameKo} 알`} style={{ height, filter: `drop-shadow(0 0 ${GLOW[lv]}px ${A.color})` }} />
        {(lv === 'crack' || ready) && <EggCracks k={height / 420} />}
      </div>
      {showBar && (
        <div style={{ position: 'absolute', left: cx - 230, top: bottom + 28, width: 460, textAlign: 'center' }}>
          <Bar value={egg.studyMin} max={egg.needMin} height={38} color={`linear-gradient(${A.color}, #FFD15C)`} label={`부화 에너지 ${egg.studyMin} / ${egg.needMin}분`} />
          <div className="chip" style={{ justifyContent: 'center', fontSize: 26, height: 46, marginTop: 10 }}>
            {ready ? '✨ 부화할 준비가 됐어요!' : `영어 학습 ${remain}분이 더 필요해요`}
          </div>
        </div>
      )}
    </>
  );
}
