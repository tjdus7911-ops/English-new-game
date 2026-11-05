/** ⑦ 영어 학습관 — 학습 메뉴 6종 (학습 콘텐츠는 기획서 확정 후 연결, 지금은 학습 완료 화면으로 이어짐) */
import { Icon, Screen, TopHud } from '../ui/kit';
import { go } from '../app/router';
import { LEARN_MENU } from '../data/mock';

export function LearnHallScreen() {
  return (
    <Screen bgName="learning_hall" tint="rgba(30,15,80,.25)" testId="screen-learn">
      <TopHud showBack />
      <div className="arch-banner">영어 학습관</div>
      <div className="learn-grid">
        {LEARN_MENU.map((m) => (
          <button key={m.id} type="button" className="learn-card" onClick={() => go('reward', { from: m.id, t: Date.now() })} data-testid={`learn-${m.id}`}>
            <Icon name={m.icon} size={130} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
