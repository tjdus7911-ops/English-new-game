import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/app';
import { cx } from '@/lib/cx';

/** 가로형 게임 설정: 사운드 · 접근성(움직임 줄이기·글자 크기) · 저장 안내 · 초기화(2단계 확인) */
export function MansionSettings() {
  const nav = useNavigate();
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const resetAll = useApp((s) => s.resetAll);
  const [confirm, setConfirm] = useState(0);
  const Toggle = ({ on, onChange, label, desc, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string; testId: string }) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} data-testid={testId} className="w-full flex items-center gap-3 rounded-2xl bg-white border-2 border-[#F2D9B4] p-3 min-h-[56px] text-left">
      <span className="flex-1"><span className="block font-extrabold text-[#4A3220]">{label}</span><span className="block text-xs text-[#7A5A3A]">{desc}</span></span>
      <span className={cx('w-14 h-8 rounded-full p-1 transition', on ? 'bg-[#4FA43A]' : 'bg-[#D8C8B0]')}><span className={cx('block w-6 h-6 rounded-full bg-white shadow transition', on && 'translate-x-6')} /></span>
      <span className="sr-only">{on ? '켜짐' : '꺼짐'}</span>
    </button>
  );
  return (
    <div className="fixed inset-0 overflow-auto mansion-ui" style={{ background: 'linear-gradient(160deg, #FFF3E2, #F2D9B4)' }} data-testid="mansion-settings">
      <div className="mx-auto max-w-[980px] p-[max(12px,env(safe-area-inset-left))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => nav('/mansion')} className="mansion-chip rounded-full w-11 h-11 grid place-items-center text-xl" aria-label="저택으로">←</button>
          <h1 className="text-xl font-extrabold text-[#4A3220]">게임 설정</h1>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3 max-[560px]:grid-cols-1">
          <section className="grid gap-2 content-start">
            <h2 className="text-sm font-bold text-[#A0835F]">소리 · 접근성</h2>
            <Toggle on={settings.sound} onChange={(v) => update({ sound: v })} label="효과음" desc="별·작업·단서 효과음" testId="set-sound" />
            <Toggle on={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="움직임 줄이기" desc="카메라 이동·캐릭터 애니메이션을 짧게" testId="set-motion" />
            <div className="rounded-2xl bg-white border-2 border-[#F2D9B4] p-3">
              <p className="font-extrabold text-[#4A3220]">글자 크기</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[1, 1.15, 1.3].map((v) => (
                  <button key={v} type="button" aria-pressed={settings.textScale === v} onClick={() => update({ textScale: v })} data-testid={`set-text-${v}`}
                    className={cx('rounded-xl min-h-[44px] font-bold border-2', settings.textScale === v ? 'bg-[#4FA43A] text-white border-[#4FA43A]' : 'bg-[#FFF8EC] border-[#F2D9B4] text-[#6B4A2E]')}>{v === 1 ? '보통' : v === 1.15 ? '크게' : '아주 크게'}</button>
                ))}
              </div>
            </div>
          </section>
          <section className="grid gap-2 content-start">
            <h2 className="text-sm font-bold text-[#A0835F]">저장</h2>
            <div className="rounded-2xl bg-white border-2 border-[#F2D9B4] p-3 text-sm text-[#5A3B22]">
              <p className="font-extrabold text-[#4A3220]">이 기기에만 자동 저장돼요</p>
              <p className="mt-1">별·리모델링·스토리·학습 기록은 이 기기의 브라우저(앱) 저장소에 저장돼요. 아직 서버 계정이 없어서 <b>기기를 바꾸거나 앱 데이터를 지우면 복구할 수 없어요.</b></p>
            </div>
            <button type="button" onClick={() => nav('/my')} className="rounded-2xl bg-white border-2 border-[#F2D9B4] p-3 min-h-[52px] text-left font-bold text-[#4A3220]">학습 설정 (알림·하루 단어 수) →</button>
            <div className="rounded-2xl bg-white border-2 border-[#F2B9AA] p-3">
              <p className="font-extrabold text-[#B3361F]">모든 데이터 초기화</p>
              <p className="text-xs text-[#7A5A3A] mt-0.5">별, 리모델링, 단서, 학습 기록이 모두 삭제돼요. 되돌릴 수 없어요.</p>
              {confirm === 0 && <button type="button" onClick={() => setConfirm(1)} data-testid="reset-1" className="mt-2 rounded-xl min-h-[44px] px-4 font-bold bg-white border-2 border-[#E07A6A] text-[#B3361F]">초기화…</button>}
              {confirm === 1 && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setConfirm(0)} className="flex-1 rounded-xl min-h-[44px] font-bold bg-white border-2 border-[#F2D9B4]">취소</button>
                  <button type="button" onClick={() => { resetAll(); nav('/onboarding'); }} data-testid="reset-2" className="flex-1 rounded-xl min-h-[44px] font-bold bg-[#C2412D] text-white">정말 초기화</button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
