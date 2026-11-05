/** ⑩ 펫 도감 — 9속성 × 3종, 미획득은 실루엣 */
import { useState } from 'react';
import { Bar, Btn, Icon, Panel, Screen, SideMenu, TopHud, toast } from '../ui/kit';
import { go } from '../app/router';
import { PetPortrait } from '../pets/PetSprite';
import { eggUrl, lineupUrl } from '../pets/atlas';
import { ATTRIBUTES, ATTRIBUTE_BY_ID, SPECIES, type AttributeId, type Species } from '../data/species';
import { DEX_OWNED as DEX_BASE } from '../data/mock';
import { useGame } from '../data/store';

type Menu = 'dex' | 'growth' | 'reward';

export function DexScreen() {
  const game = useGame();
  const DEMO_PETS = game.pets;
  const DEX_OWNED = new Set([...DEX_BASE, ...game.pets.map((p) => p.speciesId)]);   // 부화한 펫은 도감에 자동 등록
  const [menu, setMenu] = useState<Menu>('dex');
  const [filter, setFilter] = useState<AttributeId | 'all'>('all');
  const [detail, setDetail] = useState<Species | null>(null);
  const list = SPECIES.filter((s) => filter === 'all' || s.attribute === filter);
  const owned = SPECIES.filter((s) => DEX_OWNED.has(s.id)).length;
  return (
    <Screen className="magic-bg sparkle-bg" testId="screen-dex">
      <TopHud showBack title="펫 도감" />
      <div className="book">
        <div className="book-side">
          <SideMenu<Menu> value={menu} onChange={setMenu} items={[{ id: 'dex', label: '도감', icon: 'dex' }, { id: 'growth', label: '성장 기록', icon: 'exp' }, { id: 'reward', label: '도감 보상', icon: 'chest' }]} />
        </div>
        <div className="book-main">
          {menu === 'dex' && (
            <>
              <div className="attr-filter">
                <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>전체({SPECIES.length})</button>
                {ATTRIBUTES.map((a) => (
                  <button key={a.id} type="button" className={filter === a.id ? 'on' : ''} onClick={() => setFilter(a.id)} aria-label={a.nameKo} title={a.nameKo} style={{ ['--c' as string]: a.color }}>
                    <img src={eggUrl(a.id)} alt="" style={{ height: 40 }} />
                  </button>
                ))}
              </div>
              <div className="dex-grid" data-testid="dex-grid">
                {list.map((s) => {
                  const has = DEX_OWNED.has(s.id);
                  return (
                    <button key={s.id} type="button" className={`dex-card ${has ? '' : 'locked'}`} onClick={() => (has ? setDetail(s) : toast('아직 만나지 못한 펫이에요'))} style={{ ['--c' as string]: ATTRIBUTE_BY_ID[s.attribute].color }} data-owned={has ? '1' : '0'}>
                      <PetPortrait slug={s.slug} stage={1} box={104} silhouette={!has} />
                      <span>{has ? s.nameKo : '???'}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, fontSize: 26 }}>
                <span>수집률 {owned} / {SPECIES.length}</span>
                <div style={{ flex: 1 }}><Bar value={owned} max={SPECIES.length} height={22} color="linear-gradient(#B48CFF,#7B4FE0)" /></div>
              </div>
            </>
          )}
          {menu === 'growth' && (
            <div className="list">
              {DEMO_PETS.map((p) => {
                const s = SPECIES.find((x) => x.id === p.speciesId)!;
                return (
                  <div key={p.uid} className="list-row">
                    <PetPortrait slug={s.slug} stage={p.stage} box={84} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 26 }}>{s.nameKo} <small style={{ color: 'var(--ink-soft)' }}>Lv.{p.level}</small></div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>{[1, 2, 3].map((n) => <span key={n} className={`stage-pill ${n <= p.stage ? 'on' : ''}`}>{n}단계</span>)}</div>
                    </div>
                    <Btn size="sm" variant="purple" onClick={() => go('room', { pet: p.uid })}>육성방</Btn>
                  </div>
                );
              })}
            </div>
          )}
          {menu === 'reward' && (
            <div className="list">
              {[5, 10, 15, 20, 27].map((n) => (
                <div key={n} className="list-row">
                  <Icon name="chest" size={70} />
                  <div style={{ flex: 1, fontSize: 26 }}>펫 {n}종 수집<div style={{ marginTop: 6 }}><Bar value={Math.min(owned, n)} max={n} height={18} color="linear-gradient(#FFD86B,#F5A623)" label={`${Math.min(owned, n)}/${n}`} /></div></div>
                  <Btn size="sm" variant={owned >= n ? 'gold' : 'white'} disabled={owned < n} onClick={() => toast('보상 지급은 게임 시스템 단계에서 연결돼요')}>{owned >= n ? '받기' : '진행 중'}</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {detail && (
        <Panel title={detail.nameKo} style={{ left: 268, top: 170, width: 1000, height: 600 }} onClose={() => setDetail(null)}>
          <img src={lineupUrl(detail.slug)} alt={`${detail.nameKo} 성장 단계`} style={{ width: '100%', height: 380, objectFit: 'contain' }} />
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 24, marginTop: 6 }}>
            <span>속성 <b style={{ color: ATTRIBUTE_BY_ID[detail.attribute].color }}>{ATTRIBUTE_BY_ID[detail.attribute].nameKo}</b></span>
            <span>획득일 <b>2026.11.05</b></span>
            <span>최고 단계 <b>{DEMO_PETS.find((p) => p.speciesId === detail.id)?.stage ?? 1}단계</b></span>
          </div>
        </Panel>
      )}
    </Screen>
  );
}
