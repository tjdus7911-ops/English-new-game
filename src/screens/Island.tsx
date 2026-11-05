/**
 * ⑤ 메인 아일랜드 (홈)
 * 건물 탭 → 기능 화면. 보유 펫은 섬의 풀밭·길(이동 구역) 안에서만 돌아다닌다 → 건물·나무·연못을 통과하지 않음.
 * 원근: 화면 아래(앞)로 올수록 크게.
 */
import { useMemo, useState } from 'react';
import { HudIcon, Screen, TopHud } from '../ui/kit';
import { go } from '../app/router';
import { PetBrain, type Zone } from '../pets/brain';
import { usePetWorld } from '../pets/usePetWorld';
import { PetActor } from '../pets/PetSprite';
import { DEMO_PETS } from '../data/mock';
import { SPECIES_BY_ID } from '../data/species';
import { useFx } from '../ui/fx';

/** 이동 구역 (배경 1536×864 좌표, 볼록 다각형) */
export const ISLAND_ZONES: Zone[] = [
  { id: 'meadow', poly: [[520, 385], [640, 372], [745, 430], [770, 520], [690, 548], [610, 470]] },
  { id: 'south-path', poly: [[580, 618], [800, 598], [1060, 604], [1250, 596], [1262, 632], [1040, 650], [760, 655], [585, 652]] },
  { id: 'east', poly: [[1192, 452], [1300, 462], [1312, 556], [1210, 580]] },
  { id: 'castle-yard', poly: [[180, 352], [320, 348], [372, 386], [250, 402], [170, 392]] },
  { id: 'west-path', poly: [[248, 470], [330, 452], [338, 560], [272, 572], [240, 520]] },
];
const persp = (y: number) => 0.72 + Math.max(0, Math.min(1, (y - 340) / 320)) * 0.5;

const BUILDINGS = [
  { id: 'learn', label: '영어 학습관', at: [300, 210], hit: [140, 60, 320, 270], to: () => go('learn') },
  { id: 'adopt', label: '알 분양소', at: [1235, 175], hit: [1110, 180, 260, 230], to: () => go('adopt') },
  { id: 'house', label: '펫 하우스', at: [500, 455], hit: [390, 440, 230, 180], to: () => go('room') },
] as const;

export function IslandScreen() {
  const pets = DEMO_PETS.slice(0, 6);
  const brains = useMemo(() => pets.map((p, i) => new PetBrain({ zone: ISLAND_ZONES[i % ISLAND_ZONES.length], speedScale: 0.8 })), []); // eslint-disable-line react-hooks/exhaustive-deps
  usePetWorld(brains);
  const fx = useFx();
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Screen bgName="main_island" testId="screen-island">
      {BUILDINGS.map((b) => (
        <button key={b.id} type="button" aria-label={b.label} onClick={b.to} data-testid={`bld-${b.id}`} className="bld-hit"
          style={{ left: b.hit[0], top: b.hit[1], width: b.hit[2], height: b.hit[3] }} />
      ))}
      {pets.map((p, i) => {
        const b = brains[i];
        const sp = SPECIES_BY_ID[p.speciesId];
        const h = (p.stage === 1 ? 72 : p.stage === 2 ? 92 : 112) * persp(b.y);
        return (
          <PetActor key={p.uid} slug={sp.slug} stage={p.stage} motion={b.motion} startedAt={b.startedAt} height={h} x={b.x} y={b.y} facing={b.facing} label={sp.nameKo}
            onTap={() => {
              const now = performance.now();
              if (b.isSleeping) b.request('wake_up', now); else b.request('pet_reaction', now);
              fx.burst('heart', b.x, b.y - h, 4);
              setPicked(p.uid);
            }} />
        );
      })}
      {BUILDINGS.map((b) => (
        <button key={b.id} type="button" className="bld-label" onClick={b.to} style={{ left: b.at[0], top: b.at[1] }}>{b.label}</button>
      ))}
      {picked && (() => {
        const i = pets.findIndex((p) => p.uid === picked); const b = brains[i];
        return <button type="button" className="mini-go pop" style={{ left: b.x, top: b.y + 8, zIndex: 1000 }} onClick={() => go('room', { pet: picked })}>육성방 ▶</button>;
      })()}
      {fx.layer}

      <TopHud extra={<HudIcon name="calendar" label="출석" onClick={() => go('missions')} />} />
      <div className="left-rail">
        <HudIcon name="scroll" label="일일 미션" badge onClick={() => go('missions')} />
      </div>
      <div className="right-rail">
        <HudIcon name="dex" label="도감" onClick={() => go('dex')} />
        <HudIcon name="bag" label="가방" onClick={() => go('shop', { tab: 'bag' })} />
        <HudIcon name="settings" label="설정" onClick={() => go('profile', { tab: 'settings' })} />
      </div>
    </Screen>
  );
}
