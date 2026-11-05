/**
 * ④ 알 부화 화면
 * - 알이 얼마나 부화에 가까운지는 '영어 학습으로 쌓인 유효 학습 시간'으로만 정해진다(시간이 흘러서 줄어드는 타이머 없음).
 * - 부화 조건을 채운 알만 '부화시키기'가 눌리고, 그때에만 부화 연출이 나온다.
 * - 연출: 흔들림 → 균열 → 속성 이펙트 → 알 깨짐 → 펫 등장 → Happy → 도감 등록
 */
import { useEffect, useRef, useState } from 'react';
import { Btn, Screen, Panel } from '../ui/kit';
import { go } from '../app/router';
import { eggUrl } from '../pets/atlas';
import { ATTRIBUTE_BY_ID, SPECIES_BY_ID } from '../data/species';
import { PetActor } from '../pets/PetSprite';
import { useFx } from '../ui/fx';
import { hatchEgg, isReady, useGame, type GamePet } from '../data/store';
import { EggCracks, EggStage, eggLevel } from './EggView';

type Phase = 'wait' | 'shake' | 'crack' | 'burst' | 'break' | 'pet' | 'dex';
const STEPS: { label: string; icon: string }[] = [
  { label: '대기', icon: '🥚' }, { label: '흔들리기', icon: '〰' }, { label: '금 가기', icon: '⚡' }, { label: '부화!', icon: '✦' },
];
const LEVEL_STEP = { calm: 0, wiggle: 1, crack: 2, ready: 3 } as const;

export function HatchScreen({ params }: { params: URLSearchParams }) {
  const game = useGame();
  const wanted = params.get('egg');
  const egg = game.eggs.find((e) => e.uid === wanted) ?? (params.get('autostart') ? undefined : game.eggs[0]);
  const [phase, setPhase] = useState<Phase>('wait');
  const [born, setBorn] = useState<GamePet | null>(null);
  const eggSnap = useRef(egg);
  if (egg) eggSnap.current = egg; // 부화하면 store 에서 알이 사라지므로 연출용으로 보관
  const fx = useFx();
  const shown = eggSnap.current;

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

  if (!shown) {
    return (
      <Screen className="magic-bg sparkle-bg" testId="screen-hatch">
        <h1 className="title-text" style={{ position: 'absolute', left: 0, right: 0, top: 260, textAlign: 'center', fontSize: 48, margin: 0 }}>부화 중인 알이 없어요</h1>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', justifyContent: 'center', gap: 20 }}>
          <Btn onClick={() => go('adopt')}>알 분양소 가기</Btn><Btn variant="white" onClick={() => go('island')}>메인 아일랜드</Btn>
        </div>
      </Screen>
    );
  }
  const A = ATTRIBUTE_BY_ID[shown.attr];
  const species = born ? SPECIES_BY_ID[born.speciesId] : null;
  const ready = isReady(shown);
  const start = () => {
    if (phase !== 'wait' || !isReady(shown)) return;
    const pet = hatchEgg(shown.uid);
    if (pet) { setBorn(pet); setPhase('shake'); }
  };
  const stepIdx = phase === 'wait' ? LEVEL_STEP[eggLevel(shown)] : phase === 'shake' ? 1 : phase === 'crack' || phase === 'burst' ? 2 : 3;
  const broken = phase === 'break' || phase === 'pet' || phase === 'dex';
  const egg_src = eggUrl(A.id);

  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-hatch">
      <h1 className="title-text" style={{ position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center', fontSize: 54, margin: 0 }}>
        {species && (phase === 'pet' || phase === 'dex') ? `${species.nameKo}가 태어났어요!` : ready && phase === 'wait' ? '알이 곧 깨어날 것 같아요!' : '알이 부화하고 있어요!'}
      </h1>
      {(phase === 'burst' || phase === 'break') && <div className="hatch-burst" style={{ background: `radial-gradient(circle, #fff 0%, ${A.color} 30%, ${A.color}00 65%)` }} />}

      {phase === 'wait' && <EggStage egg={shown} />}
      {(phase === 'shake' || phase === 'crack' || phase === 'burst') && (
        <>
          <div style={{ position: 'absolute', left: 768 - 260, top: 570, width: 520, height: 130, borderRadius: '50%', background: `radial-gradient(${A.color}AA, ${A.color}00 70%)`, filter: 'blur(4px)' }} />
          <div className={`hatch-egg ${phase === 'shake' ? 'egg-shake' : 'egg-shake-hard'}`} data-testid="egg">
            <img src={egg_src} alt={`${A.nameKo} 알`} style={{ height: 420, filter: `drop-shadow(0 0 60px ${A.color})` }} />
            {(phase === 'crack' || phase === 'burst') && <EggCracks />}
          </div>
        </>
      )}
      {broken && (<><img src={egg_src} alt="" className="egg-half top" /><img src={egg_src} alt="" className="egg-half bottom" /></>)}
      {species && (phase === 'pet' || phase === 'dex') && <PetActor slug={species.slug} stage={1} motion="happy" startedAt={phase === 'pet' ? 1 : 2} height={330} x={768} y={660} facing={1} />}

      {phase === 'wait' && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 136, textAlign: 'center' }}>
          <p className="title-text" style={{ fontSize: 28, margin: 0 }}>{ready ? '부화시키기를 눌러 새 친구를 만나 보세요!' : '영어 학습을 하면 부화 에너지가 쌓여요!'}</p>
        </div>
      )}
      <div className="dark-panel" style={{ position: 'absolute', right: 70, top: 200, width: 230, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, opacity: i <= stepIdx ? 1 : .45 }}>
            <span style={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: i <= stepIdx ? A.color : 'rgba(255,255,255,.15)', fontSize: 26, boxShadow: i === stepIdx ? `0 0 16px ${A.color}` : undefined }}>{s.icon}</span>{s.label}
          </div>
        ))}
      </div>
      {phase === 'wait' && (
        <>
          <div style={{ position: 'absolute', left: 70, bottom: 50 }}><Btn variant="purple" onClick={() => go('learn')} testId="to-learn">영어 학습하러 가기 ▶</Btn></div>
          <div style={{ position: 'absolute', right: 70, bottom: 50, display: 'flex', gap: 14 }}>
            <Btn variant="white" onClick={() => go('room', { egg: shown.uid })}>펫 하우스</Btn>
            {ready && <Btn variant="pink" onClick={start} testId="hatch-now">부화시키기 ✦</Btn>}
          </div>
        </>
      )}
      {phase === 'dex' && species && (
        <Panel title="도감 등록!" style={{ right: 70, bottom: 60, width: 420, textAlign: 'center' }} className="pop">
          <p style={{ fontSize: 30, margin: '0 0 6px' }}>{species.nameKo}</p>
          <p style={{ fontSize: 22, margin: '0 0 18px', color: 'var(--ink-soft)' }}>{A.nameKo} 속성 · 1단계 아기</p>
          <Btn onClick={() => go('room', { pet: born!.uid })} testId="to-room">내 펫 만나기 ▶</Btn>
        </Panel>
      )}
      {fx.layer}
    </Screen>
  );
}
