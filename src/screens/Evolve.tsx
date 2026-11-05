/**
 * ⑨ 펫 성장 및 진화 화면
 * 연출: 현재 단계 → 빛 기둥 + 실루엣 → 섬광 → 다음 단계 등장(Level Up) → '진화 성공!' + 성장 3단계
 * 불꽃 여우 2→3단계는 전용 진화 키프레임 4장을 사용. 진화 조건·비용은 게임 시스템 단계에서 연결.
 */
import { useEffect, useState } from 'react';
import { Btn, Screen, TopHud } from '../ui/kit';
import { go } from '../app/router';
import { PetActor, PetPortrait } from '../pets/PetSprite';
import { foxEvolution } from '../pets/atlas';
import { getGame } from '../data/store';
import { ATTRIBUTE_BY_ID, SPECIES_BY_ID, type StageNo } from '../data/species';
import { useFx } from '../ui/fx';

type Phase = 'intro' | 'pillar' | 'flash' | 'reveal' | 'done';
const LABEL = ['Lv.1–14\n(아기)', 'Lv.15–39\n(성장기)', 'Lv.40+\n(완전체)'];

export function EvolveScreen({ params }: { params: URLSearchParams }) {
  const pets = getGame().pets;
  const pet = pets.find((p) => p.uid === params.get('pet')) ?? pets[0];
  const sp = SPECIES_BY_ID[pet.speciesId];
  const attr = ATTRIBUTE_BY_ID[sp.attribute];
  const from = Math.min(pet.stage, 2) as StageNo;
  const to = (from + 1) as StageNo;
  const special = sp.slug === 'fire_fox' && from === 2;
  const [phase, setPhase] = useState<Phase>('intro');
  const [kf, setKf] = useState(0);
  const fx = useFx();

  useEffect(() => {
    const d: Record<Phase, number> = { intro: 1300, pillar: 1500, flash: 500, reveal: 2200, done: 0 };
    if (phase === 'done') return;
    if (phase === 'reveal') fx.burst('spark', 768, 420, 16);
    const t = setTimeout(() => setPhase(({ intro: 'pillar', pillar: 'flash', flash: 'reveal', reveal: 'done' } as const)[phase]), special && phase === 'pillar' ? 3200 : d[phase]);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!special || phase !== 'pillar') return; setKf(0); const t = setInterval(() => setKf((k) => Math.min(3, k + 1)), 800); return () => clearInterval(t); }, [phase, special]);

  const cur: StageNo = phase === 'reveal' || phase === 'done' ? to : from;
  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-evolve">
      <TopHud showBack />
      {phase !== 'done' && (
        <>
          {special && phase === 'pillar' && <img src={foxEvolution()[kf]} alt="" className="evo-kf" key={kf} />}
          {(phase === 'pillar' && !special) && <div className="evo-pillar" style={{ ['--c' as string]: attr.color }} />}
          <div style={{ filter: phase === 'pillar' ? 'brightness(0) invert(1) drop-shadow(0 0 30px #fff)' : undefined, opacity: special && phase === 'pillar' ? 0 : 1, transition: 'filter .6s' }}>
            <PetActor slug={sp.slug} stage={cur} motion={phase === 'reveal' ? 'level_up' : 'idle'} startedAt={phase === 'reveal' ? 1 : 0} height={cur === 3 ? 440 : 380} x={768} y={720} facing={1} />
          </div>
          {phase === 'flash' && <div className="evo-flash" />}
          <p className="title-text" style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontSize: 40 }}>{phase === 'reveal' ? `${sp.nameKo}가 진화했어요!` : `${sp.nameKo}가 진화하려고 해요…`}</p>
        </>
      )}
      {phase === 'done' && (
        <>
          <div className="rays" style={{ top: 470 }} />
          <div className="ribbon-title pop" style={{ top: 110 }}>진화 성공!</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 30 }}>
            {([1, 2, 3] as StageNo[]).map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'flex-end', gap: 30 }}>
                <div className={`evo-card ${s === to ? 'now' : ''}`} style={{ ['--c' as string]: attr.color }}>
                  <PetPortrait slug={sp.slug} stage={s} box={s === 3 ? 330 : s === 2 ? 280 : 230} frame={s === to ? 'emo_happy' : 'idle'} />
                  <div className="evo-label">{LABEL[s - 1]}</div>
                </div>
                {s < 3 && <span className="evo-arrow">➜</span>}
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', justifyContent: 'center', gap: 20 }}>
            <Btn variant="white" onClick={() => { setPhase('intro'); }}>다시 보기 ↺</Btn>
            <Btn onClick={() => go('room', { pet: pet.uid })}>육성방으로 ▶</Btn>
          </div>
        </>
      )}
      {fx.layer}
    </Screen>
  );
}
