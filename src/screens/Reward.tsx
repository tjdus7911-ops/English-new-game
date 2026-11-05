/** ⑧ 학습 완료 및 보상 화면 (표시값은 시안 값 — 실제 보상 계산은 게임 시스템 단계) */
import { useEffect, useRef, useState } from 'react';
import { Btn, Icon, Screen } from '../ui/kit';
import { go } from '../app/router';
import { PetActor } from '../pets/PetSprite';
import { REWARD } from '../data/mock';
import { useFx } from '../ui/fx';
import { addCoins, addStudy, getGame } from '../data/store';
import { CONFIG } from '../data/config';

export function RewardScreen({ params }: { params: URLSearchParams }) {
  const fx = useFx();
  // 학습 1회 완료 → 코인 지급 + 부화 중인 알에 유효 학습 시간 적립 (새로고침·재렌더로 중복 지급되지 않도록 학습 id 별 1회)
  const paid = useRef(false);
  const [hatchGain, setHatchGain] = useState<{ added: number; ready: boolean } | null>(null);
  useEffect(() => {
    const key = `reward-${params.get('from') ?? ''}-${params.get('t') ?? ''}`;
    if (paid.current || window.sessionStorage.getItem('reward-paid') === key) return;
    paid.current = true;
    try { window.sessionStorage.setItem('reward-paid', key); } catch { /* 무시 */ }
    addCoins(REWARD.coins);
    const r = addStudy(CONFIG.studyMinPerSession);
    if (r.eggUid) { const e = getGame().eggs.find((x) => x.uid === r.eggUid); setHatchGain({ added: r.added, ready: !!e && e.studyMin >= e.needMin }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      {hatchGain && (
        <div className="chip pop" style={{ position: 'absolute', left: '50%', bottom: 150, transform: 'translateX(-50%)', fontSize: 30, height: 60, padding: '0 28px' }} data-testid="hatch-gain">
          🥚 알 부화 에너지 +{hatchGain.added}분{hatchGain.ready ? ' · 이제 부화할 수 있어요!' : ''}
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 16 }}>
        {hatchGain && <Btn size="lg" variant="purple" onClick={() => go('room', { egg: getGame().eggs[0]?.uid ?? '' })} testId="to-house">펫 하우스 ▶</Btn>}
        <Btn size="lg" onClick={() => go('island')} testId="continue">계속하기 ▶</Btn>
      </div>
      {fx.layer}
    </Screen>
  );
}
