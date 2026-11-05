/**
 * ④ 알 육성 및 부화 진행 화면
 * 연출: 알 등장 → 흔들림 → 균열 → 속성 이펙트 → 알 깨짐 → 펫 등장 → Happy → 도감 등록
 * 부화 대기 시간·확률은 게임 로직 단계에서 연결 (지금은 시안 표시값, 데모로 해당 속성 A 펫이 등장)
 */
import { useEffect, useState } from 'react';
import { Btn, Screen, Panel } from '../ui/kit';
import { go } from '../app/router';
import { eggUrl } from '../pets/atlas';
import { ATTRIBUTE_BY_ID, SPECIES_BY_ATTR, type AttributeId } from '../data/species';
import { PetActor } from '../pets/PetSprite';
import { useFx } from '../ui/fx';

type Phase = 'wait' | 'shake' | 'crack' | 'burst' | 'break' | 'pet' | 'dex';
const STEPS: { id: Phase[]; label: string; icon: string }[] = [
  { id: ['wait'], label: '대기', icon: '🥚' },
  { id: ['shake'], label: '흔들리기', icon: '〰' },
  { id: ['crack', 'burst'], label: '금 가기', icon: '⚡' },
  { id: ['break', 'pet', 'dex'], label: '부화!', icon: '✦' },
];

export function HatchScreen({ params }: { params: URLSearchParams }) {
  const attr = (params.get('attr') ?? 'fire') as AttributeId;
  const A = ATTRIBUTE_BY_ID[attr] ?? ATTRIBUTE_BY_ID.fire;
  const species = SPECIES_BY_ATTR(A.id)[0];
  const [phase, setPhase] = useState<Phase>('wait');
  const [sec, setSec] = useState(29 * 60 + 58);
  const fx = useFx();

  useEffect(() => { const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const seq: [Phase, number][] = [['shake', 1800], ['crack', 1300], ['burst', 900], ['break', 900], ['pet', 2600]];
    const i = seq.findIndex(([p]) => p === phase);
    if (phase === 'wait' || phase === 'dex') return;
    if (phase === 'burst') fx.burst('spark', 768, 420, 14);
    if (phase === 'pet') fx.burst('heart', 768, 400, 8);
    const t = setTimeout(() => setPhase(i < seq.length - 1 ? seq[i + 1][0] : 'dex'), seq[i][1]);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const stepIdx = STEPS.findIndex((s) => s.id.includes(phase));
  const egg = eggUrl(A.id);
  const broken = phase === 'break' || phase === 'pet' || phase === 'dex';
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');

  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-hatch">
      <h1 className="title-text" style={{ position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center', fontSize: 54, margin: 0 }}>
        {phase === 'pet' || phase === 'dex' ? `${species.nameKo}가 태어났어요!` : '알이 부화하고 있어요!'}
      </h1>
      {/* 바닥 둥지 + 속성 빛 */}
      <div style={{ position: 'absolute', left: 768 - 260, top: 560, width: 520, height: 130, borderRadius: '50%', background: `radial-gradient(${A.color}AA, ${A.color}00 70%)`, filter: 'blur(4px)' }} />
      {(phase === 'burst' || phase === 'break') && <div className="hatch-burst" style={{ background: `radial-gradient(circle, #fff 0%, ${A.color} 30%, ${A.color}00 65%)` }} />}

      {!broken && (
        <div className={`hatch-egg ${phase === 'shake' ? 'egg-shake' : phase === 'crack' || phase === 'burst' ? 'egg-shake-hard' : 'float'}`} onClick={() => phase === 'wait' && setPhase('shake')} data-testid="egg">
          <img src={egg} alt={`${A.nameKo} 알`} style={{ height: 420, filter: `drop-shadow(0 0 40px ${A.color})` }} />
          {(phase === 'crack' || phase === 'burst') && (
            <svg viewBox="0 0 100 130" className="crack" aria-hidden>
              <path d="M50 18 L44 34 L54 44 L42 58 L56 70 L46 84" />
              <path d="M54 44 L66 50 L62 60" /><path d="M42 58 L32 62" />
            </svg>
          )}
        </div>
      )}
      {broken && (
        <>
          <img src={egg} alt="" className="egg-half top" />
          <img src={egg} alt="" className="egg-half bottom" />
        </>
      )}
      {(phase === 'pet' || phase === 'dex') && <PetActor slug={species.slug} stage={1} motion="happy" startedAt={phase === 'pet' ? 1 : 2} height={330} x={768} y={660} facing={1} />}

      {/* 타이머 */}
      {phase === 'wait' && (
        <div style={{ position: 'absolute', left: 768 - 150, top: 690, width: 300, textAlign: 'center' }}>
          <div className="chip" style={{ justifyContent: 'center', fontSize: 40, height: 64, gap: 12 }}>⏱ {mm}:{ss}</div>
        </div>
      )}
      {phase === 'wait' && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 136, textAlign: 'center' }}>
          <p className="title-text" style={{ fontSize: 28, margin: 0 }}>영어 학습을 하면 부화 시간이 빨라져요!</p>
        </div>
      )}
      {/* 단계 */}
      <div className="dark-panel" style={{ position: 'absolute', right: 70, top: 200, width: 230, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, opacity: i <= stepIdx ? 1 : .45 }}>
            <span style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: i <= stepIdx ? A.color : 'rgba(255,255,255,.15)', fontSize: 26, boxShadow: i === stepIdx ? `0 0 16px ${A.color}` : undefined }}>{s.icon}</span>{s.label}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 70, bottom: 50 }}>
        {phase === 'wait' && <Btn variant="purple" onClick={() => go('learn')}>바로 학습하러 가기 ▶</Btn>}
      </div>
      {phase === 'wait' && <div style={{ position: 'absolute', right: 70, bottom: 50 }}><Btn variant="pink" onClick={() => setPhase('shake')} testId="hatch-now">부화 연출 보기 ✦</Btn></div>}

      {phase === 'dex' && (
        <Panel title="도감 등록!" style={{ right: 70, bottom: 60, width: 420, textAlign: 'center' }} className="pop">
          <p style={{ fontSize: 30, margin: '0 0 6px' }}>{species.nameKo}</p>
          <p style={{ fontSize: 22, margin: '0 0 18px', color: 'var(--ink-soft)' }}>{A.nameKo} 속성 · 1단계 아기</p>
          <Btn onClick={() => go('island')} testId="to-island">메인 아일랜드로 ▶</Btn>
        </Panel>
      )}
      {fx.layer}
    </Screen>
  );
}
