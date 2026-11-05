/** 개발 검수용: 27종 × 3단계 × 전체 모션 재생 확인 (#/dev-motions) */
import { useState } from 'react';
import { Btn, Screen, TopHud } from '../ui/kit';
import { PetActor } from '../pets/PetSprite';
import { MOTIONS, type MotionId } from '../data/motions';
import { SPECIES, type StageNo } from '../data/species';

const IDS = Object.keys(MOTIONS).filter((m) => m !== 'nuzzle') as MotionId[];

export function MotionLab() {
  const [si, setSi] = useState(0);
  const [stage, setStage] = useState<StageNo>(1);
  const [tick, setTick] = useState(1);
  const sp = SPECIES[si];
  return (
    <Screen bgName="pet_room" tint="rgba(30,15,80,.35)" testId="screen-motionlab">
      <TopHud showBack title={`모션 검수 · ${sp.nameKo}`} />
      <div style={{ position: 'absolute', left: 30, top: 110, display: 'flex', gap: 10, zIndex: 60, flexWrap: 'wrap', width: 1480 }}>
        <Btn size="sm" variant="white" onClick={() => setSi((si + SPECIES.length - 1) % SPECIES.length)}>‹ 이전 펫</Btn>
        <Btn size="sm" variant="white" onClick={() => setSi((si + 1) % SPECIES.length)}>다음 펫 ›</Btn>
        {([1, 2, 3] as StageNo[]).map((s) => <Btn key={s} size="sm" variant={stage === s ? 'gold' : 'purple'} onClick={() => setStage(s)}>{s}단계</Btn>)}
        <Btn size="sm" variant="pink" onClick={() => setTick((t) => t + 1)}>다시 재생 ↺</Btn>
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: 190, bottom: 20, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gridAutoRows: 215, gap: 6 }}>
        {IDS.map((m) => (
          <div key={m} style={{ position: 'relative', background: 'rgba(255,255,255,.55)', borderRadius: 16, overflow: 'hidden' }}>
            <PetActor slug={sp.slug} stage={stage} motion={m} startedAt={tick} height={130} x={73} y={180} facing={1} />
            <span style={{ position: 'absolute', left: 6, top: 4, fontSize: 16, color: 'var(--purple-d)' }}>{m}</span>
          </div>
        ))}
      </div>
    </Screen>
  );
}
