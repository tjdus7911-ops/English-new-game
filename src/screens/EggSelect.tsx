/** ③ 9가지 속성 알 선택 화면 */
import { useState } from 'react';
import { Btn, Screen } from '../ui/kit';
import { go } from '../app/router';
import { eggUrl } from '../pets/atlas';
import { ATTRIBUTES, SPECIES_BY_ATTR, type AttributeId } from '../data/species';
import { ATTR_DESC } from '../data/mock';
import { PetPortrait } from '../pets/PetSprite';

export function EggSelectScreen() {
  const [sel, setSel] = useState<AttributeId>('fire');
  const a = ATTRIBUTES.find((x) => x.id === sel)!;
  const d = ATTR_DESC[sel];
  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-egg-select">
      <h1 className="title-text" style={{ position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center', fontSize: 52, margin: 0 }}>어떤 속성의 알을 만나고 싶나요?</h1>
      <div className="panel" style={{ left: 90, top: 150, width: 760, height: 660, padding: 26 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, height: '100%' }}>
          {ATTRIBUTES.map((x) => (
            <button key={x.id} type="button" onClick={() => setSel(x.id)} data-testid={`egg-${x.id}`} aria-pressed={sel === x.id}
              style={{ borderRadius: 24, background: sel === x.id ? `linear-gradient(#FFF6D8, #FFE6A0)` : '#F3EEFF', boxShadow: sel === x.id ? `0 0 0 5px ${x.color}, 0 8px 18px rgba(40,10,90,.25)` : '0 4px 0 #D7CBF5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'transform .15s', transform: sel === x.id ? 'scale(1.04)' : undefined }}>
              <img src={eggUrl(x.id)} alt="" style={{ height: 130, filter: 'drop-shadow(0 6px 8px rgba(40,10,90,.3))' }} className={sel === x.id ? 'float' : ''} />
              <span style={{ fontSize: 28, color: x.color, WebkitTextStroke: '0.5px rgba(0,0,0,.15)' }}>{x.nameKo}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel" style={{ left: 890, top: 150, width: 560, height: 660, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 26px', background: `linear-gradient(#FFFDF6, #FFF1D6)` }}>
        <img src={eggUrl(sel)} alt="" className="float" style={{ height: 250, filter: `drop-shadow(0 0 30px ${a.color}) drop-shadow(0 10px 12px rgba(40,10,90,.3))` }} key={sel} />
        <h2 style={{ fontSize: 46, margin: '8px 0 4px', color: a.color, WebkitTextStroke: '1px rgba(0,0,0,.2)' }}>{d.title}</h2>
        <p style={{ fontSize: 26, textAlign: 'center', whiteSpace: 'pre-line', margin: 0, color: 'var(--ink-soft)', lineHeight: 1.4 }}>{d.desc}</p>
        <div style={{ display: 'flex', gap: 10, margin: '14px 0 20px' }}>
          {SPECIES_BY_ATTR(sel).map((s) => (
            <div key={s.id} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 3px 0 #EBD9B0' }} title={s.nameKo}><PetPortrait slug={s.slug} stage={1} box={110} /></div>
          ))}
        </div>
        <Btn size="lg" variant="pink" onClick={() => go('hatch', { attr: sel })} testId="choose-egg">이 알로 선택! ▶</Btn>
      </div>
    </Screen>
  );
}
