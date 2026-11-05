/** ③ 9가지 속성 알 선택 화면 */
import { useState } from 'react';
import { Btn, Screen, toast } from '../ui/kit';
import { go } from '../app/router';
import { claimFirstEgg } from '../data/store';
import { CONFIG } from '../data/config';
import { eggUrl } from '../pets/atlas';
import { ATTRIBUTES, SPECIES_BY_ATTR, type AttributeId } from '../data/species';
import { ATTR_DESC } from '../data/mock';
import { PetPortrait } from '../pets/PetSprite';

export function EggSelectScreen() {
  const [sel, setSel] = useState<AttributeId>('fire');
  const a = ATTRIBUTES.find((x) => x.id === sel)!;
  const d = ATTR_DESC[sel];
  const premium = sel === 'night'; // 첫 무료 알은 일반 속성에서만 — 밤의 알은 프리미엄(분양소 구매)
  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-egg-select">
      <h1 className="title-text" style={{ position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center', fontSize: 52, margin: 0 }}>어떤 속성의 알을 만나고 싶나요?</h1>
      <div className="panel" style={{ left: 90, top: 150, width: 760, height: 660, padding: 26 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, height: '100%' }}>
          {ATTRIBUTES.map((x) => (
            <button key={x.id} type="button" onClick={() => setSel(x.id)} data-testid={`egg-${x.id}`} aria-pressed={sel === x.id}
              style={{ borderRadius: 24, background: sel === x.id ? `linear-gradient(#FFF6D8, #FFE6A0)` : '#F3EEFF', boxShadow: sel === x.id ? `0 0 0 5px ${x.color}, 0 8px 18px rgba(40,10,90,.25)` : '0 4px 0 #D7CBF5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'transform .15s', transform: sel === x.id ? 'scale(1.04)' : undefined }}>
              <img src={eggUrl(x.id)} alt="" style={{ height: 130, filter: 'drop-shadow(0 6px 8px rgba(40,10,90,.3))' }} className={sel === x.id ? 'float' : ''} />
              <span style={{ fontSize: 28, color: x.color, WebkitTextStroke: '0.5px rgba(0,0,0,.15)' }}>{x.nameKo}{x.id === 'night' && <small style={{ fontSize: 16, color: '#fff', background: '#6A3FC8', borderRadius: 8, padding: '0 6px', marginLeft: 6, WebkitTextStroke: 0 }}>프리미엄</small>}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel" style={{ left: 890, top: 150, width: 560, height: 660, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 26px', background: `linear-gradient(#FFFDF6, #FFF1D6)` }}>
        <img src={eggUrl(sel)} alt="" className="float" style={{ height: 196, filter: `drop-shadow(0 0 30px ${a.color}) drop-shadow(0 10px 12px rgba(40,10,90,.3))` }} key={sel} />
        <h2 style={{ fontSize: 42, margin: '4px 0 2px', color: a.color, WebkitTextStroke: '1px rgba(0,0,0,.2)' }}>{d.title}</h2>
        <p style={{ fontSize: 24, textAlign: 'center', whiteSpace: 'pre-line', margin: 0, color: 'var(--ink-soft)', lineHeight: 1.35 }}>{d.desc}</p>
        <div style={{ display: 'flex', gap: 10, margin: '12px 0 10px' }}>
          {SPECIES_BY_ATTR(sel).map((s) => (
            <div key={s.id} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 3px 0 #EBD9B0' }} title={s.nameKo}><PetPortrait slug={s.slug} stage={1} box={96} /></div>
          ))}
        </div>
        <div className="random-note" data-testid="random-note">
          <b>🎲 선택한 속성의 펫 3종 중 1종이 랜덤으로 태어납니다!</b>
          <span>어떤 친구가 태어날지는 부화 후 확인할 수 있어요.</span>
        </div>
        {premium ? (
          <Btn size="lg" variant="white" onClick={() => toast('밤의 알은 알 분양소에서 만날 수 있어요')} testId="choose-egg">프리미엄 알 · 분양소 {CONFIG.eggPrice.night}코인</Btn>
        ) : (
          <Btn size="lg" variant="pink" onClick={() => go('hatch', { egg: claimFirstEgg(sel) })} testId="choose-egg">이 알로 선택! ▶</Btn>
        )}
      </div>
    </Screen>
  );
}
