/**
 * ⑪ 알 분양소 — 알버트 할아버지 + 9속성 알 회전 캐러셀 (좌우 버튼 · 드래그/스와이프 · 마지막→처음 순환)
 * 중앙 알 = 선택된 알. 분양하면 코인이 차감되고 알이 소유 데이터에 등록되며, 펫 하우스에서 학습으로 부화시킨다(즉시 부화 없음).
 */
import { useRef, useState } from 'react';
import { Btn, Icon, Panel, Screen, TopHud, bg, toast, useImagesReady } from '../ui/kit';
import { go } from '../app/router';
import { eggUrl, uiUrl } from '../pets/atlas';
import { ATTRIBUTES, ATTRIBUTE_BY_ID, SPECIES_BY_ATTR } from '../data/species';
import { ATTR_DESC } from '../data/mock';
import { PetPortrait } from '../pets/PetSprite';
import { CONFIG } from '../data/config';
import { buyEgg, useGame } from '../data/store';

const N = ATTRIBUTES.length;
const STAR = [[8, 12], [86, 20], [20, 70], [78, 78], [50, 4], [92, 55], [4, 45]] as const;

export function AdoptScreen() {
  const game = useGame();
  const [cur, setCur] = useState(Math.max(0, ATTRIBUTES.findIndex((a) => a.id === 'snow')));
  const [confirm, setConfirm] = useState(false);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const ready = useImagesReady([bg('egg_shop'), uiUrl('npc_albert.webp'), ...ATTRIBUTES.map((a) => eggUrl(a.id))]);
  const a = ATTRIBUTES[cur];
  const price = CONFIG.eggPrice[a.id];
  const premium = a.id === 'night';
  const rot = (d: number) => setCur((c) => (c + d + N) % N);

  const doBuy = () => {
    setConfirm(false);
    const r = buyEgg(a.id);
    if (!r.ok) { toast(`코인이 부족해요 (필요 ${price.toLocaleString()} · 보유 ${game.coins.toLocaleString()})`); return; }
    toast(`${a.nameKo} 알을 분양받았어요! 펫 하우스에서 학습으로 부화시켜 보세요`);
    go('room', { egg: r.uid });
  };

  return (
    <Screen bgName="egg_shop" testId="screen-adopt">
      <TopHud showBack title="알 분양소" />
      {ready ? (
        <>
          <img src={uiUrl('npc_albert.webp')} alt="알버트 할아버지" style={{ position: 'absolute', left: -20, bottom: -60, height: 700, filter: 'drop-shadow(0 16px 24px rgba(20,0,50,.5))' }} />
          <div className="speech pop" style={{ left: 330, top: 96, fontSize: 25, padding: '16px 24px' }}>새로운 친구의 알이 필요하구나?<br />영어 학습을 열심히 하면<br />더 많은 알을 분양받을 수 있단다!</div>
        </>
      ) : <div className="toast" style={{ top: 420 }}>알을 가져오는 중…</div>}

      {ready && (
        <div className="carousel" data-testid="carousel"
          onPointerDown={(e) => { drag.current = { x: e.clientX, moved: false }; }}
          onPointerMove={(e) => { if (drag.current && Math.abs(e.clientX - drag.current.x) > 8) drag.current.moved = true; }}
          onPointerUp={(e) => {
            const d = drag.current; drag.current = null;
            if (d && Math.abs(e.clientX - d.x) > 40) rot(e.clientX < d.x ? 1 : -1);
          }}
          onPointerLeave={() => { drag.current = null; }}>
          {ATTRIBUTES.map((x, i) => {
            const d = ((i - cur + N + 4) % N) - 4;   // -4..4 : 중앙으로부터의 자리
            const ad = Math.abs(d);
            const shown = ad <= 1;
            const isNight = x.id === 'night';
            return (
              <button key={x.id} type="button" className={`cz-egg ${d === 0 ? 'on' : ''}`} aria-label={`${x.nameKo} 알`} data-testid={`cz-${x.id}`} data-pos={d}
                tabIndex={shown ? 0 : -1}
                onClick={() => { if (drag.current?.moved) return; if (d !== 0) rot(d > 0 ? 1 : -1); }}
                style={{
                  transform: `translateX(${d * 270}px) translateZ(${-ad * 170}px) rotateY(${-d * 32}deg) scale(${d === 0 ? 1 : 0.74})`,
                  opacity: shown ? (d === 0 ? 1 : 0.82) : 0, pointerEvents: shown ? 'auto' : 'none', zIndex: 10 - ad,
                  ['--c' as string]: x.color,
                }}>
                {isNight && <span className="night-aura" aria-hidden>{STAR.map(([l, t], k) => <i key={k} style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${k * 0.4}s` }}>✦</i>)}</span>}
                <img src={eggUrl(x.id)} alt="" draggable={false} />
                {isNight && <span className="premium-tag">PREMIUM</span>}
              </button>
            );
          })}
          <button type="button" className="sw-arrow page-arrow" style={{ left: 0 }} onClick={() => rot(-1)} aria-label="이전 알" data-testid="cz-prev">‹</button>
          <button type="button" className="sw-arrow page-arrow" style={{ right: 0 }} onClick={() => rot(1)} aria-label="다음 알" data-testid="cz-next">›</button>
        </div>
      )}

      {ready && (
        <div className="panel adopt-info" data-testid="adopt-info" style={{ left: 560, top: 540, width: 900, height: 276, padding: '22px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <div>
            <div style={{ fontSize: 40, color: a.color, WebkitTextStroke: '1px rgba(0,0,0,.2)', lineHeight: 1.1 }}>{ATTR_DESC[a.id].title}{premium && <small className="premium-chip">프리미엄</small>}</div>
            <p style={{ fontSize: 22, margin: '6px 0 8px', color: 'var(--ink-soft)', whiteSpace: 'pre-line', lineHeight: 1.3 }}>{ATTR_DESC[a.id].desc}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {SPECIES_BY_ATTR(a.id).map((s) => <div key={s.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 3px 0 #EBD9B0' }} title={s.nameKo}><PetPortrait slug={s.slug} stage={1} box={84} /></div>)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="random-note" data-testid="random-note" style={{ margin: 0, width: '100%' }}>
              <b>🎲 이 속성의 펫 3종 중 한 친구가 랜덤으로 태어나요!</b>
              <span>알은 영어 학습으로 부화시켜요.</span>
            </div>
            <Btn size="lg" onClick={() => setConfirm(true)} testId="adopt" variant={premium ? 'purple' : 'gold'}>
              <span>알 분양하기</span><span className="price"><Icon name="coin" size={36} />{price.toLocaleString()}</span>
            </Btn>
          </div>
        </div>
      )}
      {confirm && (
        <Panel title="알 분양" style={{ left: 568, top: 260, width: 400, textAlign: 'center', zIndex: 900 }} onClose={() => setConfirm(false)}>
          <img src={eggUrl(a.id)} alt="" style={{ height: 150 }} />
          <p style={{ fontSize: 26, margin: '8px 0 6px' }}>{ATTRIBUTE_BY_ID[a.id].nameKo} 알을 분양받을까요?</p>
          <p style={{ fontSize: 22, margin: '0 0 14px', color: 'var(--ink-soft)' }}>{price.toLocaleString()} 코인 · 보유 {game.coins.toLocaleString()}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Btn size="sm" variant="white" onClick={() => setConfirm(false)}>취소</Btn>
            <Btn size="sm" onClick={doBuy} testId="adopt-ok">분양받기</Btn>
          </div>
        </Panel>
      )}
    </Screen>
  );
}
