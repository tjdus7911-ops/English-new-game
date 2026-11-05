/** ⑭ 사용자 프로필 및 설정 */
import { useState } from 'react';
import { Bar, Btn, Screen, SideMenu, TopHud, toast } from '../ui/kit';
import { go } from '../app/router';
import { uiUrl } from '../pets/atlas';
import { PLAYER } from '../data/mock';
import { useGame } from '../data/store';
import { SPECIES } from '../data/species';

type Menu = 'profile' | 'settings' | 'account' | 'help';

export function ProfileScreen({ params }: { params: URLSearchParams }) {
  const game = useGame();
  const [menu, setMenu] = useState<Menu>((params.get('tab') as Menu) || 'profile');
  const [opts, setOpts] = useState({ bgm: true, sfx: true, motion: false, push: true });
  return (
    <Screen bgName="main_island" tint="rgba(30,15,80,.5)" testId="screen-profile">
      <TopHud showBack title="프로필" />
      <div className="book">
        <div className="book-side">
          <SideMenu<Menu> value={menu} onChange={setMenu} items={[{ id: 'profile', label: '프로필', icon: 'crown' }, { id: 'settings', label: '설정', icon: 'settings' }, { id: 'account', label: '계정', icon: 'mail' }, { id: 'help', label: '도움말', icon: 'notice' }]} />
        </div>
        <div className="book-main">
          {menu === 'profile' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
                <img src={uiUrl('avatar_player.webp')} alt="" style={{ width: 200, height: 200, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', background: '#CDE7FF', border: '6px solid #fff', boxShadow: '0 0 0 5px #9A78F0' }} />
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 50, margin: 0 }}>{PLAYER.name}</h2>
                  <div style={{ fontSize: 30, margin: '6px 0 10px', color: 'var(--purple-d)' }}>Lv.{PLAYER.level}</div>
                  <Bar value={PLAYER.exp} max={PLAYER.expMax} height={28} color="linear-gradient(#9C6CFF,#6A3FD8)" label={`${PLAYER.exp} / ${PLAYER.expMax}`} />
                </div>
                <img src={uiUrl('bg/main_island.webp')} alt="" style={{ width: 300, height: 190, objectFit: 'cover', borderRadius: 26, border: '5px solid #fff', boxShadow: '0 0 0 4px #9A78F0' }} />
              </div>
              <div className="stat-row">
                {[['보유 펫', `${new Set(game.pets.map((p) => p.speciesId)).size} / ${SPECIES.length}`], ['섬 레벨', `Lv.${PLAYER.islandLevel}`], ['학습 횟수', `${PLAYER.studyCount}회`], ['연속 학습', `${PLAYER.streak}일 🔥`]].map(([k, v]) => (
                  <div key={k} className="stat"><span>{k}</span><b>{v}</b></div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 24 }}><Btn variant="white" onClick={() => toast('프로필 꾸미기는 준비 중이에요')}>프로필 꾸미기</Btn></div>
            </>
          )}
          {menu === 'settings' && (
            <div className="list">
              {([['bgm', '배경 음악'], ['sfx', '효과음'], ['motion', '움직임 줄이기'], ['push', '알림 받기']] as const).map(([k, label]) => (
                <div key={k} className="list-row" style={{ fontSize: 28 }}>
                  <span style={{ flex: 1 }}>{label}</span>
                  <button type="button" role="switch" aria-checked={opts[k]} className={`switch ${opts[k] ? 'on' : ''}`} onClick={() => setOpts({ ...opts, [k]: !opts[k] })}><span /></button>
                </div>
              ))}
              <div className="list-row" style={{ fontSize: 24 }}><span style={{ flex: 1 }}>모션 미리보기 (개발 검수용)</span><Btn size="sm" variant="purple" onClick={() => go('dev-motions')}>열기</Btn></div>
            </div>
          )}
          {menu === 'account' && (
            <div className="list">
              <div className="list-row" style={{ fontSize: 26 }}><span style={{ flex: 1 }}>게스트 계정으로 플레이 중</span><Btn size="sm" onClick={() => toast('계정 연동은 준비 중이에요')}>계정 연동</Btn></div>
              <div className="list-row" style={{ fontSize: 26 }}><span style={{ flex: 1 }}>타이틀 화면으로</span><Btn size="sm" variant="white" onClick={() => go('title')}>이동</Btn></div>
            </div>
          )}
          {menu === 'help' && (
            <div className="list" style={{ fontSize: 24, lineHeight: 1.6 }}>
              {['알을 부화시키면 속성별 3종 펫 중 하나가 태어나요.', '펫을 탭하면 쓰다듬을 수 있어요. 계속 쓰다듬으면 가까이 다가와 부비부비해요.', '영어 학습관에서 공부하면 보상과 경험치를 받아요.', '펫은 3단계까지 진화해요. 도감을 완성해 보세요!'].map((t) => <div key={t} className="list-row">{t}</div>)}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
