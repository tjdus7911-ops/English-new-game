/** ① 타이틀 및 게임 시작 화면 */
import { useEffect } from 'react';
import { Btn, HudIcon, Screen, bg, preloadImages, toast } from '../ui/kit';
import { go } from '../app/router';
import { PetActor } from '../pets/PetSprite';
import { eggUrl, uiUrl } from '../pets/atlas';

export function TitleScreen() {
  // 프롤로그(할아버지·알 분양소 배경)를 타이틀에서 미리 받아 둔다
  useEffect(() => { void preloadImages([bg('egg_shop'), uiUrl('npc_albert.webp')]); }, []);
  return (
    <Screen bgName="title" testId="screen-title">
      <div style={{ position: 'absolute', right: 26, top: 22, zIndex: 10 }}><HudIcon name="settings" label="설정" onClick={() => go('profile', { tab: 'settings' })} /></div>
      <div className="float" style={{ position: 'absolute', left: 120, top: 90, width: 760, textAlign: 'center' }}>
        <div style={{ position: 'relative', height: 150 }}>
          <span style={{ position: 'absolute', left: 278, top: 0, fontSize: 70, transform: 'rotate(-20deg)', color: '#fff', textShadow: '0 0 10px #9AD' }}>❦</span>
          <img src={eggUrl('love')} alt="" style={{ position: 'absolute', left: 330, top: 0, height: 150, filter: 'drop-shadow(0 8px 14px rgba(60,20,120,.45)) hue-rotate(40deg) saturate(1.2)' }} />
          <span style={{ position: 'absolute', left: 430, top: 0, fontSize: 70, transform: 'scaleX(-1) rotate(-20deg)', color: '#fff', textShadow: '0 0 10px #9AD' }}>❦</span>
        </div>
        <div className="logo">EGG ISLAND</div>
        <p className="title-text" style={{ fontSize: 30, margin: '14px 0 0' }}>알을 부화시키고, 영어를 배우며, 나만의 펫을 키워요!</p>
      </div>
      {/* 타이틀의 친구들 */}
      <PetActor slug="fire_fox" stage={1} motion="happy" startedAt={1} height={250} x={640} y={760} facing={-1} />
      <PetActor slug="aqua_bunny" stage={1} motion="idle" height={170} x={260} y={790} facing={1} />
      <PetActor slug="snow_fox" stage={1} motion="idle" height={150} x={430} y={720} facing={1} />
      <PetActor slug="crescent_cat" stage={1} motion="curious" startedAt={1} height={150} x={860} y={780} facing={-1} />
      <div style={{ position: 'absolute', left: 1020, bottom: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <Btn size="lg" onClick={() => go('prologue')} testId="start">게임 시작 ▶</Btn>
        <div style={{ display: 'flex', gap: 14 }}>
          <Btn size="sm" variant="white" onClick={() => toast('계정 연동은 준비 중이에요')}>계정 연동</Btn>
          <Btn size="sm" variant="white" onClick={() => go('prologue')}>게스트 플레이</Btn>
        </div>
      </div>
    </Screen>
  );
}
