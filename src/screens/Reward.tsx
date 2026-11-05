/** ⑧ 학습 완료 및 보상 화면 (표시값은 시안 값 — 실제 보상 계산은 게임 시스템 단계) */
import { useEffect } from 'react';
import { Btn, Icon, Screen } from '../ui/kit';
import { go } from '../app/router';
import { PetActor } from '../pets/PetSprite';
import { REWARD } from '../data/mock';
import { useFx } from '../ui/fx';

export function RewardScreen({ params }: { params: URLSearchParams }) {
  void params;
  const fx = useFx();
  useEffect(() => { fx.burst('spark', 768, 300, 16); const t = setInterval(() => fx.burst('spark', 400 + Math.random() * 736, 250 + Math.random() * 200, 5), 1400); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const items = [
    { icon: 'exp', label: 'EXP', value: `+${REWARD.exp}`, color: '#3E9E30' },
    { icon: 'coin', label: '코인', value: `+${REWARD.coins}`, color: '#C27A00' },
    { icon: 'heart', label: '친밀도', value: `+${REWARD.intimacy}`, color: '#E0447F' },
  ];
  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-reward">
      <div className="rays" />
      <div className="ribbon-title pop">학습 완료!</div>
      <PetActor slug="fire_fox" stage={2} motion="excited" startedAt={1} height={270} x={768} y={440} facing={1} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', justifyContent: 'center', gap: 30 }}>
        {items.map((it, i) => (
          <div key={it.label} className="reward-card pop" style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
            <Icon name={it.icon} size={96} />
            <b style={{ color: it.color }}>{it.value}</b>
            <span>{it.label}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, textAlign: 'center' }}>
        <Btn size="lg" onClick={() => go('island')} testId="continue">계속하기 ▶</Btn>
      </div>
      {fx.layer}
    </Screen>
  );
}
