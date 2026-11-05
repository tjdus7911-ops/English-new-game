/** ⑬ 일일 미션 및 업적 (진행 계산·보상 지급은 게임 시스템 단계) */
import { useState } from 'react';
import { Bar, Btn, Icon, Screen, Tabs, TopHud, toast } from '../ui/kit';
import { ACHIEVEMENTS, DAILY_MISSIONS } from '../data/mock';

type Tab = 'daily' | 'ach';

export function MissionsScreen({ params }: { params?: URLSearchParams }) {
  const [tab, setTab] = useState<Tab>(params?.get('tab') === 'ach' ? 'ach' : 'daily');
  const list = tab === 'daily' ? DAILY_MISSIONS : ACHIEVEMENTS;
  const allDone = DAILY_MISSIONS.every((m) => m.cur >= m.max);
  return (
    <Screen bgName="learning_hall" tint="rgba(30,15,80,.45)" testId="screen-missions">
      <TopHud showBack title="미션" />
      <div className="book" style={{ right: 470 }}>
        <div className="book-main">
          <Tabs<Tab> value={tab} onChange={setTab} items={[{ id: 'daily', label: '일일 미션', badge: true }, { id: 'ach', label: '업적' }]} />
          <div className="list" style={{ marginTop: 14 }}>
            {list.map((m) => {
              const done = m.cur >= m.max;
              return (
                <div key={m.id} className="list-row">
                  <Icon name={m.icon} size={64} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26 }}><span>{m.label}</span><span style={{ color: 'var(--ink-soft)' }}>({m.cur}/{m.max})</span></div>
                    <div style={{ marginTop: 8 }}><Bar value={m.cur} max={m.max} height={20} color="linear-gradient(#8BE476,#3E9E30)" /></div>
                  </div>
                  {done ? <span className="check">✓</span> : <span className="check" style={{ background: '#DDD3F3', boxShadow: 'none' }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="panel" style={{ right: 60, top: 160, width: 380, bottom: 36, background: 'linear-gradient(#FFF7DE,#FFE9B0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div className="panel-ribbon" style={{ background: 'linear-gradient(#FFD86B,#F5A623 60%,#D9820A)', boxShadow: '0 5px 0 #9A5200', borderColor: '#FFF1C2' }}>일일 보상</div>
        <Icon name="chest" size={220} className={allDone ? 'float' : ''} />
        <p style={{ fontSize: 28, textAlign: 'center', margin: 0 }}>모두 완료 시<br />특별 보상!</p>
        <Btn disabled={!allDone} onClick={() => toast('보상 지급은 게임 시스템 단계에서 연결돼요')}>보상 받기</Btn>
      </div>
    </Screen>
  );
}
