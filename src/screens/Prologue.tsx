/** ② 프롤로그 — 알버트 할아버지와 대화 */
import { useEffect, useState } from 'react';
import { Btn, Screen } from '../ui/kit';
import { go } from '../app/router';
import { uiUrl } from '../pets/atlas';
import { PROLOGUE } from '../data/mock';

export function PrologueScreen() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const line = PROLOGUE[i];
  useEffect(() => { setN(0); const t = setInterval(() => setN((x) => (x >= line.length ? x : x + 1)), 38); return () => clearInterval(t); }, [line]);
  const done = n >= line.length;
  const next = () => { if (!done) { setN(line.length); return; } if (i < PROLOGUE.length - 1) setI(i + 1); else go('egg-select'); };
  return (
    <Screen bgName="egg_shop" tint="linear-gradient(90deg, rgba(40,20,90,.15), rgba(40,20,90,.35))" testId="screen-prologue">
      <div onClick={next} style={{ position: 'absolute', inset: 0 }}>
        <img src={uiUrl('npc_albert.webp')} alt="알버트 할아버지" className="float" style={{ position: 'absolute', left: 90, bottom: -40, height: 820, filter: 'drop-shadow(0 20px 30px rgba(20,0,50,.5))' }} />
        <div className="panel" style={{ left: 660, top: 230, width: 800, minHeight: 330, padding: '64px 46px 40px' }}>
          <div className="panel-ribbon" style={{ left: 150, fontSize: 30 }}>알버트 할아버지</div>
          <p style={{ fontSize: 35, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-line', minHeight: 180 }}>{line.slice(0, n)}<span style={{ opacity: done ? 0 : 1 }}>▍</span></p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ color: 'var(--ink-soft)', fontSize: 22 }}>{i + 1} / {PROLOGUE.length}</span>
            <button type="button" className="round-btn pulse" aria-label="다음" data-testid="next" style={{ background: 'linear-gradient(#FFE27A,#F5A623)', color: '#6A3A00', boxShadow: '0 4px 0 #B86F00' }} onClick={(e) => { e.stopPropagation(); next(); }}>›</button>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 30, top: 24 }}><Btn size="sm" variant="white" onClick={() => go('egg-select')}>건너뛰기 ⏭</Btn></div>
    </Screen>
  );
}
