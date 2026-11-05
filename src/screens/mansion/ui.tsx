import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { assetUrl } from '@/game/assets';
import { Portrait } from '@/game/mansion/Sprites';
import SCENE from '@/game/mansion/scene.json';
import type { MansionState, RenovationTask } from '@/domain/mansion/types';
import { lockReason, starBalance, taskStatus } from '@/domain/mansion/logic';
import { chapterState } from '@/domain/story/logic';
import { LIVING_TASKS, LIVING_TASK_BY_ID, PHASES, PHASE_LABEL } from '@/content/mansion/tasks';
import { CHARACTERS } from '@/content/story/characters';
import { CLUES, CLUE_BY_ID } from '@/content/story/clues';
import { QUIZ_BY_ID } from '@/content/story/quizzes';
import { CHAPTERS, STORY_QUESTION } from '@/content/story/chapters';
import { EVENT_BY_ID, STORY_EVENTS } from '@/content/story/events';
import { shuffle } from '@/domain/learning/grading';
import { cx } from '@/lib/cx';
import { sfx } from '@/lib/sfx';
import type { DialogState } from './useDirector';

/** 가로형 모달 틀 */
export function Sheet({ children, onClose, label, wide, testId }: { children: ReactNode; onClose?: () => void; label: string; wide?: boolean; testId?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-[#2A1C10]/45 p-[max(8px,env(safe-area-inset-left))]" onClick={onClose} data-testid={testId}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className={cx('mansion-panel rounded-[28px] w-full max-h-[94%] overflow-auto pop-in relative', wide ? 'max-w-[980px]' : 'max-w-[620px]')}>
        {onClose && <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-2 top-2 z-10 w-11 h-11 rounded-full bg-white/90 border-2 border-[#F2D9B4] text-[#8A6244] text-xl font-black">✕</button>}
        {children}
      </div>
    </div>
  );
}

// ───────────────────────── 대화창 ─────────────────────────
export function DialogBox({ d, onNext }: { d: DialogState; onNext: () => void }) {
  const prof = d.who ? CHARACTERS[d.who] : null;
  const right = d.who === 'aubrey' || d.who === 'hodu';
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNext(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onNext]);
  if (!prof) {
    return (
      <button type="button" onClick={onNext} data-testid="dialog" data-who="narrator" className="absolute inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] mx-auto z-[55] w-[min(760px,calc(100%-24px))] rounded-3xl bg-[#2E2418]/88 text-[#FFF6E6] px-6 py-4 text-left shadow-2xl pop-in">
        <p className="text-[clamp(14px,2.1vh,18px)] leading-relaxed">{d.text}</p>
        <p className="text-right text-xs text-[#E9D3B0] mt-1 animate-pulse">탭하여 계속 ▼</p>
      </button>
    );
  }
  return (
    <button type="button" onClick={onNext} data-testid="dialog" data-who={prof.id} data-expr={d.expr}
      className="absolute inset-x-0 bottom-[max(8px,env(safe-area-inset-bottom))] z-[55] mx-auto w-[min(980px,calc(100%-16px))] flex items-end text-left pop-in" style={{ flexDirection: right ? 'row-reverse' : 'row' }}>
      <div className="shrink-0 -mb-1 drop-shadow-xl" style={{ width: 'min(30vh, 190px)' }}>
        <Portrait sheet={prof.portrait} expr={d.expr} size="100%" flip={right && prof.id !== 'hodu'} className="aspect-square" />
      </div>
      <div className="relative flex-1 mansion-panel rounded-[24px] px-5 pt-6 pb-3 min-h-[min(26vh,150px)]">
        <span className="absolute -top-4 px-4 py-1 rounded-full text-white font-extrabold text-sm shadow" style={{ background: prof.color, [right ? 'right' : 'left']: 18 }}>{prof.name}<span className="font-semibold opacity-80 text-xs ml-1.5">{prof.role}</span></span>
        <p className="text-[clamp(14px,2.3vh,19px)] leading-relaxed text-[#4A3220] font-medium">{d.text}</p>
        <p className="text-right text-xs text-[#B08A62] mt-1 animate-pulse">탭하여 계속 ▼</p>
      </div>
    </button>
  );
}

// ───────────────────────── 영어 추리 퀴즈 ─────────────────────────
export function StoryQuizModal({ quizId, review, onAnswer, onDone }: { quizId: string; review: boolean; onAnswer: (correct: boolean) => void; onDone: () => void }) {
  const q = QUIZ_BY_ID[quizId];
  const [wrong, setWrong] = useState(0);
  const [solved, setSolved] = useState(review);
  const [picked, setPicked] = useState<string | null>(null);
  const bank = useMemo(() => (q.tokens ? shuffle(q.tokens.map((t, i) => ({ t, i })), quizId.length * 31 + 7) : []), [q, quizId]);
  const [order, setOrder] = useState<number[]>([]);
  const submit = (given: string) => {
    const ok = given.trim().replace(/[.!?]$/, '') === q.answer.replace(/[.!?]$/, '');
    onAnswer(ok);
    if (ok) { setSolved(true); sfx('correct'); } else { setWrong((w) => w + 1); sfx('wrong'); setOrder([]); }
  };
  const showGloss = wrong >= 1 || solved;
  const showFull = wrong >= 2 || solved;
  return (
    <Sheet label="영어 추리" wide testId="story-quiz">
      <span hidden data-testid="quiz-id" data-id={quizId} />
      <div className="grid md:grid-cols-[1fr_1.15fr] gap-4 p-5 max-[700px]:grid-cols-[1fr_1.15fr]">
        <div className="rounded-2xl p-5 shadow-inner relative" style={{ background: 'repeating-linear-gradient(#FFF8E6 0 30px, #F3E3BF 30px 31px)', border: '2px solid #E2C48E' }}>
          <p className="text-xs font-bold text-[#A0835F]">🔎 {q.sourceLabel} · {q.cefr}</p>
          <p className="mt-3 whitespace-pre-line text-[clamp(18px,3.2vh,28px)] leading-snug text-[#3B2A1A]" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }} data-testid="quiz-source">{q.source}</p>
          {showGloss && (
            <div className="mt-3 flex flex-wrap gap-1.5" data-testid="quiz-gloss">
              {q.glosses.map((g) => <span key={g.en} className="rounded-full bg-white/90 border border-[#E2C48E] px-2.5 py-1 text-sm"><b className="text-[#5A3B22]">{g.en}</b> = {g.ko}</span>)}
            </div>
          )}
          {showFull && <p className="mt-2 text-sm text-[#5A3B22] bg-white/80 rounded-xl px-3 py-2" data-testid="quiz-translation">해석: {q.translation}</p>}
        </div>
        <div>
          <p className="font-extrabold text-[#4A3220] text-[clamp(15px,2.4vh,19px)] pr-10">{q.prompt}</p>
          {!solved && q.type === 'choice' && (
            <div className="grid gap-2 mt-3">
              {q.choices!.map((c, i) => (
                <button key={c} type="button" data-testid={`quiz-choice-${i}`} onClick={() => { setPicked(c); submit(c); }}
                  className={cx('text-left min-h-[48px] px-4 py-2.5 rounded-2xl border-[3px] font-semibold bg-white transition active:scale-[.98]', picked === c && wrong ? 'border-[#E07A6A] bg-[#FDECE8]' : 'border-[#F2D9B4] hover:border-[#F2A93B]')}>
                  <span className="inline-grid place-items-center w-7 h-7 rounded-full bg-[#FFF1DD] text-[#B07A30] text-sm font-black mr-2">{i + 1}</span>{c}
                </button>
              ))}
            </div>
          )}
          {!solved && q.type === 'order' && (
            <div className="mt-3">
              <div className="min-h-[52px] rounded-2xl border-[3px] border-dashed border-[#E2C48E] bg-white/70 p-2 flex flex-wrap gap-1.5" data-testid="quiz-order-line">
                {order.length === 0 && <span className="text-sm text-[#B08A62] p-2">아래 단어를 순서대로 눌러 주세요</span>}
                {order.map((i) => <button key={i} type="button" onClick={() => setOrder(order.filter((x) => x !== i))} className="px-3 min-h-[44px] rounded-xl bg-[#FFF1DD] border-2 border-[#F2D9B4] font-bold">{bank.find((b) => b.i === i)!.t}</button>)}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {bank.map((b) => <button key={b.i} type="button" data-testid={`quiz-token-${b.t}-${b.i}`} disabled={order.includes(b.i)} onClick={() => { const next = [...order, b.i]; setOrder(next); if (next.length === bank.length) submit(next.map((k) => bank.find((x) => x.i === k)!.t).join(' ')); }}
                  className={cx('px-3 min-h-[44px] rounded-xl border-2 font-bold', order.includes(b.i) ? 'opacity-30 border-transparent' : 'bg-white border-[#F2D9B4]')}>{b.t}</button>)}
              </div>
            </div>
          )}
          {!solved && wrong > 0 && (
            <p className="mt-3 text-sm font-semibold text-[#B3361F] bg-[#FDECE8] rounded-xl px-3 py-2" role="status" data-testid="quiz-hint">
              {wrong >= 2 ? '전체 해석을 열어 두었어요. 해석을 보고 다시 골라 보세요!' : '아쉬워요! 왼쪽 단어 힌트를 보고 다시 도전해 보세요.'}
            </p>
          )}
          {solved && (
            <div className="mt-3 rounded-2xl bg-[#E6F5DD] border-2 border-[#9CCB74] p-4 pop-in" role="status" data-testid="quiz-solved">
              <p className="font-extrabold text-[#2F7A2F] text-lg">{review ? '정답 다시 보기' : '해석 성공! 🎉'}</p>
              <p className="mt-1 font-semibold text-[#3B2A1A]">{q.type === 'order' ? `${q.answer}.` : q.answer}</p>
              <p className="text-sm text-[#4A5A3A] mt-1">{q.explanation}</p>
              <button type="button" onClick={onDone} data-testid="quiz-continue" className="mansion-btn mt-3 w-full min-h-[48px] rounded-2xl font-extrabold text-lg">계속</button>
            </div>
          )}
          <p className="text-[11px] text-[#A0835F] mt-3">영어 추리는 별을 쓰지 않아요. 틀려도 힌트가 열리고, 두 번 틀리면 전체 해석을 보여 드려요.</p>
        </div>
      </div>
    </Sheet>
  );
}

// ───────────────────────── 단서 획득 카드 ─────────────────────────
export function ClueCard({ clueId, onClose }: { clueId: string; onClose: () => void }) {
  const c = CLUE_BY_ID[clueId];
  return (
    <Sheet label="단서 발견" testId="clue-card">
      <div className="p-6 text-center">
        <p className="text-sm font-black tracking-widest text-[#C27C1E]">✦ 단서 발견 ✦</p>
        <div className="relative mx-auto mt-2 w-40 h-32 grid place-items-center">
          <div className="absolute inset-0 rounded-full fx-glow-static" />
          <img src={assetUrl(c.assetKey)} alt="" className="relative max-h-full max-w-full prop-pop drop-shadow-xl" />
        </div>
        <p className="mt-2 text-xl font-extrabold text-[#4A3220]" data-testid="clue-name">{c.name}</p>
        <p className="mt-2 text-lg text-[#3B2A1A]" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>"{c.sentence}"</p>
        <p className="text-sm text-[#7A5A3A]">{c.translation}</p>
        <button type="button" onClick={onClose} data-testid="clue-close" className="mansion-btn-gold mt-4 w-full min-h-[48px] rounded-2xl font-extrabold text-lg">단서 수집함에 보관</button>
      </div>
    </Sheet>
  );
}

// ───────────────────────── 미션 보드 ─────────────────────────
export function MissionBoard({ m, onClose, onRun, onLearn }: { m: MansionState; onClose: () => void; onRun: (taskId: string) => void; onLearn: () => void }) {
  const done = LIVING_TASKS.filter((t) => taskStatus(m, t) === 'completed').length;
  const bal = starBalance(m);
  const ch = chapterState(m, CHAPTERS[1], STORY_EVENTS);
  return (
    <Sheet label="미션 보드" onClose={onClose} wide testId="mission-board">
      <div className="p-5">
        <div className="flex items-end gap-4 pr-12 flex-wrap">
          <div>
            <p className="text-xs font-bold text-[#A0835F]">미션 보드</p>
            <h2 className="text-xl font-extrabold text-[#4A3220]">CH.01 거실의 비밀</h2>
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="flex justify-between text-xs font-bold text-[#7A5A3A]"><span>리모델링 {done}/{LIVING_TASKS.length}</span><span>스토리 {ch.completed}/{ch.total}</span></div>
            <div className="h-3 mt-1 rounded-full bg-[#F2E2C8] overflow-hidden" role="progressbar" aria-valuenow={done} aria-valuemax={LIVING_TASKS.length} aria-label="거실 진행률"><div className="h-full rounded-full bg-gradient-to-r from-[#7CCB5C] to-[#4FA43A]" style={{ width: `${(done / LIVING_TASKS.length) * 100}%` }} /></div>
          </div>
          <span className="mansion-chip rounded-full px-3 py-1.5 font-extrabold text-[#8A5A00]" data-testid="board-stars">★ {bal}</span>
        </div>
        {PHASES.map((ph) => {
          const list = LIVING_TASKS.filter((t) => t.phase === ph);
          return (
            <section key={ph} className="mt-4" data-testid={`board-phase-${ph}`}>
              <h3 className="text-sm font-extrabold text-[#7A5A3A]">{PHASE_LABEL[ph]} <span className="text-[#A0835F]">{list.filter((t) => taskStatus(m, t) === 'completed').length}/{list.length}</span></h3>
              <ul className="mt-1.5 grid sm:grid-cols-2 gap-2 max-[700px]:grid-cols-2">
                {list.map((t) => <MissionRow key={t.id} t={t} m={m} bal={bal} onRun={onRun} onLearn={onLearn} />)}
              </ul>
            </section>
          );
        })}
        <p className="mt-3 text-xs text-[#A0835F]">영어 학습 스테이지를 처음 통과할 때마다 별 1개를 받아요. 이미 완료한 미션은 다시 별을 쓰지 않아요.</p>
      </div>
    </Sheet>
  );
}

function MissionRow({ t, m, bal, onRun, onLearn }: { t: RenovationTask; m: MansionState; bal: number; onRun: (id: string) => void; onLearn: () => void }) {
  const st = taskStatus(m, t);
  const lr = lockReason(m, t);
  const lack = st === 'available' && bal < t.costStars;
  return (
    <li data-testid={`mission-${t.id}`} data-status={st} className={cx('rounded-2xl border-2 p-3 flex items-center gap-3', st === 'completed' ? 'bg-[#EEF7E8] border-[#C5E3B2]' : st === 'available' ? 'bg-white border-[#F2C55C] shadow' : 'bg-[#F7EFE3] border-[#EADBC4] opacity-80')}>
      <span className={cx('shrink-0 grid place-items-center w-10 h-10 rounded-full text-lg font-black', st === 'completed' ? 'bg-[#7CCB5C] text-white' : st === 'available' ? 'bg-[#FFD25E] text-[#6B4300]' : 'bg-[#E6D6BE] text-[#A0835F]')} aria-hidden>{st === 'completed' ? '✓' : st === 'available' ? '▶' : '🔒'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-[#4A3220] leading-tight">{t.title}</p>
        <p className="text-xs text-[#7A5A3A] truncate">{st === 'locked' && lr ? (lr.type === 'asset' ? '디자인 준비 중 — 곧 열려요' : lr.type === 'task' ? `먼저: ${LIVING_TASK_BY_ID[lr.id].title}` : `스토리 진행 필요: ${EVENT_BY_ID[lr.id]?.title ?? lr.id}`) : t.desc}</p>
      </div>
      {st === 'completed' ? <span className="text-xs font-bold text-[#4F8A3A]">완료</span>
        : st === 'available' ? (lack
          ? <button type="button" onClick={onLearn} data-testid={`mission-learn-${t.id}`} className="mansion-btn-gold rounded-2xl px-3 min-h-[44px] text-sm font-extrabold whitespace-nowrap">★{t.costStars} 모으기</button>
          : <button type="button" onClick={() => onRun(t.id)} data-testid={`mission-run-${t.id}`} className="mansion-btn rounded-2xl px-3 min-h-[44px] font-extrabold whitespace-nowrap">★{t.costStars} 시작</button>)
          : <span className="text-xs font-bold text-[#A0835F] whitespace-nowrap">★{t.costStars}</span>}
    </li>
  );
}

// ───────────────────────── 가구 3종 선택 ─────────────────────────
/** 색 변형 선택지 미리보기: v3 의 해당 부분을 잘라 보여 주고 변형 조각을 겹침 */
function SceneThumb({ taskId, variantId }: { taskId: string; variantId: string }) {
  const vs = (SCENE as unknown as { variants: Record<string, Record<string, { key: string; x: number; y: number; w: number; h: number }>> }).variants[taskId] ?? {};
  const any = Object.values(vs)[0];
  if (!any) return null;
  const p = vs[variantId];
  const box = { x: any.x, y: any.y, w: any.w, h: any.h };
  const pctBox = (q: typeof box) => ({ left: `${((q.x - box.x) / box.w) * 100}%`, top: `${((q.y - box.y) / box.h) * 100}%`, width: `${(q.w / box.w) * 100}%`, height: `${(q.h / box.h) * 100}%` });
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ aspectRatio: `${box.w} / ${box.h}`, maxHeight: '100%' }} data-testid={`thumb-${variantId}`}>
      <img src={assetUrl('scene/v3')} alt="" className="absolute max-w-none" style={pctBox({ x: 0, y: 0, w: 1536, h: 864 })} />
      {p && <img src={assetUrl(p.key)} alt="" className="absolute max-w-none" style={pctBox(p)} />}
    </div>
  );
}

export function VariantTray({ task, selected, free, onSelect, onCancel, onConfirm }: { task: RenovationTask; selected: string | null; free: boolean; onSelect: (id: string) => void; onCancel: () => void; onConfirm: () => void }) {
  const ids = task.variants!.map((v) => v.id);
  const step = (d: number) => { sfx('tap'); const i = selected ? ids.indexOf(selected) : -1; onSelect(ids[(i + d + ids.length) % ids.length]); };
  return (
    <div className="absolute inset-x-0 bottom-0 z-[58] pb-[max(8px,env(safe-area-inset-bottom))] px-2 pop-in" data-testid="variant-tray" role="dialog" aria-label={`${task.title} 디자인 선택`}>
      <div className="mansion-panel mx-auto max-w-[900px] rounded-[26px] p-3 flex items-center gap-3">
        <div className="hidden sm:block w-32 shrink-0 pl-2 max-[700px]:block max-[700px]:w-24">
          <p className="text-xs font-bold text-[#A0835F]">{free ? '무료 스타일 변경' : `★${task.costStars} · 미리보기`}</p>
          <p className="font-extrabold text-[#4A3220] leading-tight">{task.title}</p>
        </div>
        <button type="button" onClick={() => step(-1)} data-testid="variant-prev" aria-label="이전 디자인" className="shrink-0 grid place-items-center w-11 h-11 rounded-full bg-white border-2 border-[#F2D9B4] text-[#8A6244] text-xl font-black">‹</button>
        <div className="flex-1 grid grid-cols-3 gap-2">
          {task.variants!.map((v) => (
            <button key={v.id} type="button" onClick={() => { sfx('tap'); onSelect(v.id); }} data-testid={`variant-${v.id}`} aria-pressed={selected === v.id}
              className={cx('rounded-2xl border-[3px] bg-white p-1.5 min-h-[44px] transition', selected === v.id ? 'border-[#4FA43A] ring-4 ring-[#7CCB5C]/30 -translate-y-1' : 'border-[#F2D9B4]')}>
              <div className="h-[min(14vh,86px)] grid place-items-center overflow-hidden rounded-xl bg-[#FFF8EC]">
                {v.assetKey.startsWith('scene/') ? <SceneThumb taskId={task.id} variantId={v.id} /> : <img src={assetUrl(v.assetKey)} alt="" className="max-h-full max-w-full object-contain" />}
              </div>
              <p className="text-xs font-bold text-[#4A3220] mt-1 truncate">{selected === v.id && '✓ '}{v.label}</p>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => step(1)} data-testid="variant-next" aria-label="다음 디자인" className="shrink-0 grid place-items-center w-11 h-11 rounded-full bg-white border-2 border-[#F2D9B4] text-[#8A6244] text-xl font-black">›</button>
        <div className="flex flex-col gap-2 shrink-0">
          <button type="button" onClick={onConfirm} disabled={!selected} data-testid="variant-confirm" className="mansion-btn rounded-2xl px-4 min-h-[48px] font-extrabold">{free ? '변경' : '확정'}</button>
          <button type="button" onClick={onCancel} data-testid="variant-cancel" className="rounded-2xl px-4 min-h-[44px] font-bold bg-white border-2 border-[#F2D9B4] text-[#8A6244]">취소</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmTask({ task, onCancel, onConfirm }: { task: RenovationTask; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Sheet label={`${task.title} 확인`} onClose={onCancel} testId="task-confirm">
      <div className="p-6 text-center">
        <p className="text-xs font-bold text-[#A0835F]">CH.01 거실</p>
        <h2 className="text-xl font-extrabold text-[#4A3220] mt-1">{task.title}</h2>
        <p className="text-[#7A5A3A] mt-1">{task.desc}</p>
        <p className="mt-3 text-lg font-black text-[#8A5A00]">별 {task.costStars}개를 사용할까요?</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={onCancel} className="rounded-2xl min-h-[48px] font-bold bg-white border-2 border-[#F2D9B4] text-[#8A6244]">취소</button>
          <button type="button" onClick={onConfirm} data-testid="task-confirm-go" className="mansion-btn rounded-2xl min-h-[48px] font-extrabold text-lg">★{task.costStars} 진행</button>
        </div>
      </div>
    </Sheet>
  );
}

export function NeedStars({ task, bal, onClose, onLearn }: { task: RenovationTask; bal: number; onClose: () => void; onLearn: () => void }) {
  return (
    <Sheet label="별 부족" onClose={onClose} testId="need-stars">
      <div className="p-6 text-center">
        <p className="text-4xl">⭐</p>
        <h2 className="text-xl font-extrabold text-[#4A3220] mt-1">별이 {task.costStars - bal}개 더 필요해요</h2>
        <p className="text-[#7A5A3A] mt-1">「{task.title}」에는 별 {task.costStars}개가 필요해요. 영어 학습 스테이지를 처음 통과하면 별 1개를 받아요.</p>
        <button type="button" onClick={onLearn} data-testid="go-learn" className="mansion-btn-gold mt-4 w-full min-h-[52px] rounded-2xl font-extrabold text-lg">영어 학습하러 가기</button>
      </div>
    </Sheet>
  );
}

// ───────────────────────── 단서 수집함 ─────────────────────────
export function CluesPanel({ m, onClose }: { m: MansionState; onClose: () => void }) {
  const [sel, setSel] = useState<string | null>(CLUES.find((c) => m.story.clues[c.id])?.id ?? null);
  const c = sel ? CLUE_BY_ID[sel] : null;
  const found = CLUES.filter((x) => m.story.clues[x.id]).length;
  return (
    <Sheet label="단서 수집함" onClose={onClose} wide testId="clues-panel">
      <div className="p-5 grid grid-cols-[1.2fr_1fr] gap-4 max-[640px]:grid-cols-1">
        <div>
          <p className="text-xs font-bold text-[#A0835F]">단서 수집함 · {found}/{CLUES.length}</p>
          <h2 className="text-lg font-extrabold text-[#4A3220]">{STORY_QUESTION}</h2>
          <div className="grid grid-cols-5 gap-2 mt-3 max-[700px]:grid-cols-5">
            {CLUES.map((x) => {
              const got = !!m.story.clues[x.id];
              return (
                <button key={x.id} type="button" disabled={!got} onClick={() => setSel(x.id)} data-testid={`clue-slot-${x.id}`} data-found={got ? '1' : '0'} aria-label={got ? x.name : '아직 찾지 못한 단서'}
                  className={cx('aspect-square rounded-2xl border-[3px] grid place-items-center p-1.5 min-h-[44px]', sel === x.id ? 'border-[#F2A93B] bg-white' : 'border-[#EADBC4] bg-[#FFF8EC]')}>
                  <img src={assetUrl(x.assetKey)} alt="" className={cx('max-h-full max-w-full', !got && 'brightness-0 opacity-25')} />
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-2xl bg-[#F3E9DA] p-3 text-sm text-[#8A6A4A]">
            <p className="font-bold">다음 챕터의 단서</p>
            <p className="text-xs mt-0.5">CH.02 주방 이후의 단서는 아직 준비 중이에요. (플레이 불가)</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white border-2 border-[#F2D9B4] p-4" data-testid="clue-detail">
          {c ? (
            <>
              <div className="h-28 grid place-items-center"><img src={assetUrl(c.assetKey)} alt="" className="max-h-full" /></div>
              <p className="font-extrabold text-[#4A3220] text-lg">{c.name}</p>
              <p className="text-xs text-[#A0835F]">{CHAPTERS.find((h) => h.id === c.chapter)?.title}{c.taskId ? ` · ${LIVING_TASK_BY_ID[c.taskId]?.title}` : ''}</p>
              <p className="text-sm text-[#5A3B22] mt-2">{c.desc}</p>
              <p className="mt-2 text-lg" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>"{c.sentence}"</p>
              <p className="text-sm text-[#7A5A3A]">{c.translation}</p>
              <ul className="mt-2 text-xs text-[#5A3B22] list-disc pl-4">{c.learning.map((l) => <li key={l}>{l}</li>)}</ul>
            </>
          ) : <p className="text-sm text-[#A0835F] py-10 text-center">아직 찾은 단서가 없어요. 저택을 고치며 숨겨진 단서를 찾아보세요.</p>}
        </div>
      </div>
    </Sheet>
  );
}

// ───────────────────────── 스토리 다시보기 ─────────────────────────
export function StoryLogPanel({ m, onClose, onReplay }: { m: MansionState; onClose: () => void; onReplay: (eventId: string) => void }) {
  return (
    <Sheet label="스토리" onClose={onClose} wide testId="story-log">
      <div className="p-5">
        <p className="text-xs font-bold text-[#A0835F]">수상한 저택의 상속자</p>
        <h2 className="text-lg font-extrabold text-[#4A3220] pr-12">{STORY_QUESTION}</h2>
        <div className="mt-3 grid gap-2">
          {CHAPTERS.map((ch) => {
            const s = chapterState(m, ch, STORY_EVENTS);
            const evs = STORY_EVENTS.filter((e) => e.chapter === ch.id);
            return (
              <div key={ch.id} data-testid={`chapter-${ch.id}`} data-playable={s.playable ? '1' : '0'} className={cx('rounded-2xl border-2 p-3', s.playable ? 'bg-white border-[#F2D9B4]' : 'bg-[#F3E9DA] border-[#EADBC4]')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-extrabold text-[#4A3220]">{ch.title}</p>
                  <span className="text-xs text-[#A0835F]">{ch.place}</span>
                  <span className="ml-auto text-xs font-bold text-[#7A5A3A]">{!ch.available ? '준비 중' : !s.unlocked ? '🔒 잠김' : `${s.completed}/${s.total}`}</span>
                </div>
                <p className="text-xs text-[#7A5A3A] mt-0.5">{ch.summary}</p>
                {s.playable && evs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {evs.map((e) => {
                      const seen = m.story.completedEvents.includes(e.id);
                      return <button key={e.id} type="button" disabled={!seen} onClick={() => onReplay(e.id)} data-testid={`replay-${e.id}`}
                        className={cx('rounded-full px-3 min-h-[40px] text-sm font-bold border-2', seen ? 'bg-[#FFF1DD] border-[#F2C55C] text-[#6B4300]' : 'bg-[#F3E9DA] border-transparent text-[#B9A288]')}>{seen ? '▶ ' : '🔒 '}{e.title}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

/** 공간 화면 오른쪽 미션 패널: 5단계(청소·수리·가구·조명·소품) + 지금 단계의 작업과 다음 작업 몇 개만. 디자인 준비 중 작업은 '준비 중'으로 표시 */
export function RoomMissionPanel({ m, bal, busy, onRun, onBoard, hint }: { m: MansionState; bal: number; busy: boolean; onRun: (id: string) => void; onBoard: () => void; hint?: { label: string; onClick: () => void } }) {
  const phases = [['clean', '청소'], ['repair', '수리'], ['furniture', '가구'], ['lighting', '조명'], ['decor', '소품']] as const;
  const cur = LIVING_TASKS.find((t) => t.ready !== false && taskStatus(m, t) !== 'completed');
  const waiting = !cur && LIVING_TASKS.some((t) => taskStatus(m, t) !== 'completed');
  const curPhase = cur?.phase ?? LIVING_TASKS.find((t) => taskStatus(m, t) !== 'completed')?.phase ?? 'decor';
  const done = LIVING_TASKS.filter((t) => taskStatus(m, t) === 'completed').length;
  const inPhase = LIVING_TASKS.filter((t) => t.phase === curPhase);
  const firstOpen = Math.max(0, inPhase.findIndex((t) => t.id === cur?.id || (!cur && taskStatus(m, t) !== 'completed')));
  const visible = inPhase.slice(Math.max(0, firstOpen - 1), Math.max(0, firstOpen - 1) + 4);
  const avail = cur && taskStatus(m, cur) === 'available';
  return (
    <section aria-label="거실 리모델링 미션" data-testid="room-panel" className="pointer-events-auto absolute right-[max(10px,env(safe-area-inset-right))] top-[64px] bottom-[max(8px,env(safe-area-inset-bottom))] w-[min(31vw,320px)] mansion-panel rounded-[22px] p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1"><h2 className="mansion-title font-black text-[#4A3220] text-[15px]">거실 리모델링</h2><span className="text-xs font-bold text-[#7A5A3A]" data-testid="room-panel-progress">{done} / {LIVING_TASKS.length}</span></div>
      <div className="grid grid-cols-5 gap-1">
        {phases.map(([k, n]) => {
          const list = LIVING_TASKS.filter((t) => t.phase === k);
          const c = list.filter((t) => taskStatus(m, t) === 'completed').length;
          return <div key={k} data-testid={`phase-${k}`} className={cx('rounded-xl text-center text-[11px] font-extrabold py-0.5 border-2', k === curPhase ? 'bg-gradient-to-b from-[#F3D58C] to-[#DDB467] border-white shadow-[0_0_0_2px_#C99A45] text-[#4A2E12]' : 'bg-[#FFF8EA] border-[#E3CFA6] text-[#9C8A70]')}>{n}<span className="block text-[10px]">{c}/{list.length}</span></div>;
        })}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
        {visible.map((t) => {
          const st = taskStatus(m, t);
          return (
            <li key={t.id} data-testid={`panel-${t.id}`} data-status={st} className={cx('rounded-xl border-2 px-2 py-1.5 flex items-center gap-2 text-[13px] font-extrabold', st === 'completed' ? 'bg-[#EEF4E6] border-[#C9DDB4] text-[#5E7A4A]' : t.id === cur?.id ? 'bg-[#FFF3D0] border-[#E2B85C] text-[#4A3220]' : 'bg-[#FFFBF2] border-[#EADBC0] text-[#9C8A70]')}>
              <span className="grid place-items-center w-5 h-5 rounded-md border-2 border-[#C9A46A] text-[11px] shrink-0">{st === 'completed' ? '✓' : st === 'locked' ? '·' : ''}</span>
              <span className="flex-1 truncate">{t.title}</span>
              {t.ready === false ? <span className="text-[10px] font-bold text-[#A0835F] bg-[#F3E9DA] rounded-md px-1.5 py-0.5 shrink-0" title={t.assetNote}>디자인 준비 중</span> : <span className="text-[#8E6526]">★{t.costStars}</span>}
            </li>
          );
        })}
      </ul>
      {cur ? (
        <button type="button" disabled={busy} onClick={() => (avail ? onRun(cur.id) : hint ? hint.onClick() : onBoard())} data-testid="next-mission" className="mansion-btn-gold rounded-2xl min-h-[46px] px-3 font-black text-[15px] flex items-center justify-center gap-2">
          {avail ? (bal >= cur.costStars ? <>미션 시작 ▶</> : <>별 {cur.costStars - bal}개 더 모으기</>) : hint ? <>🔍 {hint.label}</> : <>스토리를 먼저 진행해요</>}
        </button>
      ) : waiting ? <p className="text-center text-[13px] font-extrabold text-[#8E6526] rounded-2xl bg-[#FFF3D0] px-2 py-2" data-testid="panel-waiting">지금 할 수 있는 작업을 모두 마쳤어요! 다음 작업은 디자인 준비 중이에요.</p>
        : <p className="text-center text-sm font-extrabold text-[#5E7A4A]">거실 완성! 주방이 열렸어요</p>}
    </section>
  );
}
