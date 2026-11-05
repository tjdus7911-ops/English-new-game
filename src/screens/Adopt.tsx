/** ⑪ 추가 알 분양소 — 알버트 할아버지 + 받침대 위 알 3개 (속성 넘겨 보기). 분양 처리·가격은 게임 시스템 단계 */
import { useState } from 'react';
import { Btn, Icon, Panel, Screen, TopHud, toast } from '../ui/kit';
import { go } from '../app/router';
import { eggUrl, uiUrl } from '../pets/atlas';
import { ATTRIBUTES, ATTRIBUTE_BY_ID, type AttributeId } from '../data/species';

const PEDESTALS = [683, 960, 1247];

export function AdoptScreen() {
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const eggs = ATTRIBUTES.slice(page * 3, page * 3 + 3).map((a) => a.id);
  const chosen: AttributeId = eggs[sel];
  return (
    <Screen bgName="egg_shop" testId="screen-adopt">
      <TopHud showBack title="알 분양소" />
      <img src={uiUrl('npc_albert.webp')} alt="알버트 할아버지" style={{ position: 'absolute', left: -20, bottom: -60, height: 700, filter: 'drop-shadow(0 16px 24px rgba(20,0,50,.5))' }} />
      <div className="speech" style={{ left: 330, top: 96, fontSize: 25, padding: '16px 24px' }}>새로운 친구의 알이 필요하구나?<br />영어 학습을 열심히 하면<br />더 많은 알을 분양받을 수 있단다!</div>
      {eggs.map((a, i) => (
        <button key={a} type="button" className={`pedestal-egg ${sel === i ? 'on' : ''}`} style={{ left: PEDESTALS[i], ['--c' as string]: ATTRIBUTE_BY_ID[a].color }} onClick={() => setSel(i)} aria-label={`${ATTRIBUTE_BY_ID[a].nameKo} 알`}>
          <img src={eggUrl(a)} alt="" />
          <span>{ATTRIBUTE_BY_ID[a].nameKo}</span>
        </button>
      ))}
      <button type="button" className="sw-arrow page-arrow" style={{ left: 520 }} onClick={() => setPage((p) => (p + 2) % 3)} aria-label="이전 알">‹</button>
      <button type="button" className="sw-arrow page-arrow" style={{ left: 1420 }} onClick={() => setPage((p) => (p + 1) % 3)} aria-label="다음 알">›</button>
      <div style={{ position: 'absolute', left: 960, bottom: 40, transform: 'translateX(-50%)' }}>
        <Btn size="lg" onClick={() => setConfirm(true)} testId="adopt"><span>알 분양하기</span><span className="price"><Icon name="coin" size={36} />250</span></Btn>
      </div>
      {confirm && (
        <Panel title="알 분양" style={{ left: 568, top: 260, width: 400, textAlign: 'center' }} onClose={() => setConfirm(false)}>
          <img src={eggUrl(chosen)} alt="" style={{ height: 150 }} />
          <p style={{ fontSize: 26, margin: '8px 0 16px' }}>{ATTRIBUTE_BY_ID[chosen].nameKo} 알을 분양받을까요?</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Btn size="sm" variant="white" onClick={() => setConfirm(false)}>취소</Btn>
            <Btn size="sm" onClick={() => { setConfirm(false); toast('분양 처리는 게임 시스템 단계에서 연결돼요'); go('hatch', { attr: chosen }); }}>분양받기</Btn>
          </div>
        </Panel>
      )}
    </Screen>
  );
}
