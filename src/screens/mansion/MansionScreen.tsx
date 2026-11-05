import { assetUrl } from '@/game/assets';
import { RoomMissionPanel } from './ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/store/app';
import { CameraView, type CameraApi } from '@/game/mansion/Camera';
import { MansionWorld, condOk } from '@/game/mansion/MansionWorld';
import { FOCUS, INTERACTABLES, ROOM_BY_ID, type RoomId } from '@/game/mansion/mapData';
import { Portrait } from '@/game/mansion/Sprites';
import { currentTask, starBalance, starsEarned, taskStatus } from '@/domain/mansion/logic';
import { interactEvent, nextAutoEvent } from '@/domain/story/logic';
import { LIVING_TASKS, LIVING_TASK_BY_ID } from '@/content/mansion/tasks';
import { EVENT_BY_ID, STORY_EVENTS } from '@/content/story/events';
import { CHAPTERS } from '@/content/story/chapters';
import { CLUES } from '@/content/story/clues';
import { useDirector, initialChars } from './useDirector';
import { runMissionAnimation, runStoryEvent, type StoryCommit } from './runners';
import { ClueCard, CluesPanel, ConfirmTask, DialogBox, MissionBoard, NeedStars, StoryLogPanel, StoryQuizModal, VariantTray } from './ui';
import { sfx } from '@/lib/sfx';

type Panel = null | 'board' | 'clues' | 'story';

/** 가로형 저택 화면 — 하나의 연결된 맵에서 카메라 이동·미션·캐릭터 작업·스토리가 모두 진행된다 */
export function MansionScreen() {
  const nav = useNavigate();
  const m = useApp((s) => s.mansion);
  const reduce = useApp((s) => s.settings.reduceMotion);
  const api = useApp.getState;
  const camera = useRef<CameraApi>(null);
  const d = useDirector(camera, reduce);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmTask, setConfirmTask] = useState<string | null>(null);
  const [needStars, setNeedStars] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ taskId: string; selected: string | null; free: boolean } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const commit: StoryCommit = {
    begin: (id) => api().storyBegin(id),
    grantClue: (c, e) => { api().storyGrantClue(c, e); },
    finish: (id) => api().storyFinish(id),
  };

  /** 한 번에 하나의 연출만 (애니메이션 중 중복 미션 실행 방지) */
  const exclusive = useCallback(async (fn: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try { await fn(); } finally { running.current = false; setBusy(false); }
  }, []);

  const runAutoStories = useCallback(async () => {
    for (let guard = 0; guard < 6; guard++) {
      const ev = nextAutoEvent(api().mansion, STORY_EVENTS);
      if (!ev) break;
      await runStoryEvent(d, ev, commit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // 입장 시: 끊긴 이벤트 재개 → 첫 입장 프롤로그 → 완료됐지만 연출을 못 본 미션 이벤트
  useEffect(() => {
    const t = setTimeout(() => { void exclusive(runAutoStories); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600); };

  const execute = (taskId: string, variantId?: string) => exclusive(async () => {
    const task = LIVING_TASK_BY_ID[taskId];
    // 1) 별 차감 + 미션 완료를 하나의 커밋으로 먼저 저장
    const r = api().renovateTask(taskId, variantId);
    d.setVisual((v) => ({ ...v, preview: null }));
    if (!r.ok) { flash(r.error === 'insufficient' ? '별이 부족해요.' : r.error === 'already' ? '이미 완료한 미션이에요.' : '지금은 진행할 수 없어요.'); return; }
    sfx('star');
    // 2) 작업 연출 (건너뛰거나 중단돼도 저장 상태는 이미 최종)
    await runMissionAnimation(d, task);
    // 3) 미션에 연결된 스토리 자동 실행
    await runAutoStories();
    await d.camReset();
  });

  const openTask = (taskId: string) => {
    if (running.current) return;
    const t = LIVING_TASK_BY_ID[taskId];
    const st = taskStatus(api().mansion, t);
    setPanel(null);
    if (st !== 'available') return;
    if (starBalance(api().mansion) < t.costStars) { setNeedStars(taskId); return; }
    if (t.variants?.length) {
      setPicker({ taskId, selected: null, free: false });
      void d.cam(t.slot === 'wall' ? 'wall' : t.slot === 'floor' ? 'floor' : t.slot, 1.35, 600);
    } else setConfirmTask(taskId);
  };
  const openEdit = (taskId: string) => {
    const t = LIVING_TASK_BY_ID[taskId];
    const cur = api().mansion.renovations[taskId]?.selectedVariantId ?? null;
    setPicker({ taskId, selected: cur, free: true });
    void d.cam(t.slot, 1.35, 600);
  };
  const selectVariant = (id: string) => { if (!picker) return; setPicker({ ...picker, selected: id }); d.setVisual((v) => ({ ...v, preview: { taskId: picker.taskId, variantId: id } })); };
  const cancelPicker = () => { setPicker(null); d.setVisual((v) => ({ ...v, preview: null })); void d.camReset(); };
  const confirmPicker = () => {
    if (!picker?.selected) return;
    const { taskId, selected, free } = picker;
    setPicker(null);
    if (free) {
      api().changeTaskVariant(taskId, selected);
      d.setVisual((v) => ({ ...v, preview: null }));
      const f = FOCUS[LIVING_TASK_BY_ID[taskId].slot];
      if (f) d.fx('sparkle', f.at, f.h ?? 40);
      sfx('complete');
      flash('스타일을 바꿨어요 (별 사용 없음)');
      return;
    }
    void execute(taskId, selected);
  };

  const interact = (objectId: string) => {
    const ev = interactEvent(api().mansion, STORY_EVENTS, objectId);
    if (!ev) return;
    sfx('tap');
    void exclusive(async () => { await runStoryEvent(d, ev, commit); await runAutoStories(); });
  };
  const replay = (eventId: string) => {
    setPanel(null);
    void exclusive(async () => {
      await runStoryEvent(d, EVENT_BY_ID[eventId], commit, { replay: true });
      d.setChars(initialChars());
      await d.camReset();
    });
  };
  const roomInfo = (room: string) => {
    const r = ROOM_BY_ID[room as RoomId];
    void d.cam(room, 0.95, 600);
    const ch = CHAPTERS.find((c) => c.roomId === room);
    flash(`${r.name} · ${r.locked?.chapter} ${r.locked?.label.split('·')[1]?.trim() ?? ''} — ${ch?.available ? '' : '준비 중이에요. '}거실을 먼저 복구해 주세요.`);
  };

  const bal = starBalance(m);
  const cur = currentTask(m, LIVING_TASKS);
  const curAvail = cur && taskStatus(m, cur) === 'available';
  const done = LIVING_TASKS.filter((t) => taskStatus(m, t) === 'completed').length;
  const level = 1 + Math.floor(starsEarned(m) / 3);
  const cluesFound = CLUES.filter((c) => m.story.clues[c.id]).length;
  const pickerTask = picker ? LIVING_TASK_BY_ID[picker.taskId] : null;
  // 가구 선택: 선택형 미션이 지금 열려 있으면 그 미션의 디자인 고르기, 아니면 이미 고른 가구 다시 꾸미기(무료)
  const variantNow = cur && curAvail && cur.variants ? cur : null;
  const anyChosen = LIVING_TASKS.some((t) => t.variants && taskStatus(m, t) === 'completed');
  const furnitureReady = !!variantNow || anyChosen;
  const openFurniture = () => { sfx('tap'); setEditMode((e) => !e); };
  const [panelInset, setPanelInset] = useState(() => (typeof window === 'undefined' ? 0 : Math.min(window.innerWidth * 0.31, 320) + 14));
  useEffect(() => { const on = () => setPanelInset(Math.min(window.innerWidth * 0.31, 320) + 14); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const hudHidden = busy || !!d.dialog || !!d.quiz || !!d.clue || !!picker;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#2A1F16] mansion-ui" data-testid="mansion-screen" data-busy={busy ? '1' : '0'}>
      <CameraView ref={camera} home={FOCUS.default} testId="mansion-camera" insetRight={editMode || picker ? 0 : panelInset}>
        <MansionWorld mansion={m} visual={d.visual} chars={d.chars} interactive={!busy && !picker} busy={busy} editMode={editMode}
          onHotspot={openTask} onInteract={interact} onRoomLabel={roomInfo} onEdit={openEdit} />
      </CameraView>

      {/* HUD — 화면 가장자리에 고정 (safe-area) */}
      <div className={`pointer-events-none absolute inset-0 z-40 transition-opacity ${hudHidden ? 'opacity-0' : 'opacity-100'}`} style={{ padding: 'max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto mansion-chip rounded-[22px] pl-1 pr-3 py-1 flex items-center gap-2">
            <Portrait sheet="mansion/portrait-haru" expr="normal" size={44} className="rounded-full bg-[#F1E2C4] border-2 border-[#C9A46A]" />
            <div className="leading-tight">
              <p className="text-[11px] font-bold text-[#A0835F]">하루의 저택 · Lv.{level}</p>
              <p className="text-sm font-extrabold text-[#4A3220] mansion-title">CH.01 거실 <span data-testid="room-progress">{done}/{LIVING_TASKS.length}</span></p>
              <div className="h-1.5 w-28 rounded-full bg-[#F2E2C8] overflow-hidden mt-0.5"><div className="h-full bg-[#7E9A6A]" style={{ width: `${(done / LIVING_TASKS.length) * 100}%` }} /></div>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button type="button" onClick={() => nav('/learn')} className="mansion-chip rounded-full pl-2 pr-3 min-h-[44px] flex items-center gap-1 font-black text-[#8A5A00] text-lg" data-testid="mansion-stars" aria-label={`보유 별 ${bal}개 · 학습으로 별 모으기`}>
              <AIcon name="sparkle" size={30} />{bal}<span className="ml-1 grid place-items-center w-6 h-6 rounded-full bg-[#7E9A6A] text-white text-base leading-none">+</span>
            </button>
            <HudIcon label={`단서 수집함 (${cluesFound})`} onClick={() => setPanel('clues')} testId="open-clues" badge={cluesFound || undefined}><AIcon name="key" size={30} /></HudIcon>
            <HudIcon label="스토리" onClick={() => setPanel('story')} testId="open-story"><AIcon name="book" size={30} /></HudIcon>
            <HudIcon label="설정" onClick={() => nav('/mansion/settings')} testId="open-settings"><AIcon name="gear" size={28} /></HudIcon>
          </div>
        </div>

        {/* 하단: 전체 맵 · 미션 · 가구 선택 · 영어 학습 (승인 시안 docs/mockups/stage1/room.png) */}
        <div className="absolute left-[max(10px,env(safe-area-inset-left))] bottom-[max(8px,env(safe-area-inset-bottom))] flex items-end gap-2 pointer-events-auto">
          <button type="button" onClick={() => nav('/mansion', { state: { from: 'living' } })} className="mansion-chip rounded-full w-[56px] h-[56px] grid place-items-center text-2xl font-black text-[#6B4A2E]" data-testid="back-map" aria-label="전체 맵으로">‹</button>
          <button type="button" onClick={() => setPanel('board')} className="mansion-btn-gold rounded-[20px] w-[78px] h-[64px] flex flex-col items-center justify-center relative" data-testid="open-board" aria-label="미션 보드">
            <AIcon name="hammer" size={30} /><span className="text-[11px] font-black">미션</span>
            {curAvail && <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#C8452F] text-white text-xs font-black grid place-items-center border-2 border-white">!</span>}
          </button>
          <button type="button" onClick={openFurniture} disabled={!furnitureReady} aria-pressed={editMode}
            className={`rounded-[20px] w-[78px] h-[64px] flex flex-col items-center justify-center border-[3px] shadow-lg ${editMode ? 'bg-[#566F45] text-white border-[#E2C27E]' : 'mansion-panel text-[#4A3220]'} disabled:opacity-55`} data-testid="toggle-edit">
            <AIcon name="armchair" size={30} /><span className="text-[11px] font-black">{editMode ? '선택 끝' : '가구 선택'}</span>
          </button>
          <button type="button" onClick={() => nav('/learn')} className="mansion-panel rounded-[20px] w-[78px] h-[64px] flex flex-col items-center justify-center text-[#4A3220]" data-testid="go-learn-hud" aria-label="영어 학습하러 가기">
            <AIcon name="books" size={30} /><span className="text-[11px] font-black">영어 학습</span>
          </button>
        </div>

        {/* 오른쪽 미션 패널 */}
        {!editMode && (() => {
          // 다음 작업이 스토리(단서 조사)에 막혀 있으면 패널 버튼이 그 단서로 바로 안내 — 작은 화면에서 돋보기가 상단 카드에 가려져도 진행 가능
          const done = (id: string) => taskStatus(m, LIVING_TASK_BY_ID[id]) === 'completed';
          const clue = INTERACTABLES.find((it) => condOk(it.when, done, m));
          return <RoomMissionPanel m={m} bal={bal} busy={busy} onRun={(id) => openTask(id)} onBoard={() => setPanel('board')}
            hint={clue ? { label: `${clue.label} 살펴보기`, onClick: () => interact(clue.id) } : undefined} />;
        })()}
        {editMode && <p className="pointer-events-none absolute right-3 bottom-4 mansion-chip rounded-2xl px-3 py-2 text-sm font-bold text-[#6B4A2E]">✎ 가구를 눌러 스타일을 바꿔요 · 무료</p>}
      </div>

      {d.skippable && !d.quiz && !d.clue && (
        <button type="button" onClick={d.requestSkip} data-testid="skip" className="absolute z-[70] right-[max(10px,env(safe-area-inset-right))] top-[max(8px,env(safe-area-inset-top))] rounded-full bg-[#2E2418]/75 text-white px-4 min-h-[44px] font-bold">건너뛰기 ⏭</button>
      )}
      {toast && <div role="status" className="absolute z-[65] left-1/2 -translate-x-1/2 top-[max(64px,env(safe-area-inset-top))] mansion-chip rounded-2xl px-4 py-2 text-sm font-bold text-[#5A3B22] max-w-[90%] text-center pop-in" data-testid="toast">{toast}</div>}

      {d.dialog && <DialogBox d={d.dialog} onNext={d.advance} />}
      {d.quiz && <StoryQuizModal quizId={d.quiz.id} review={d.quiz.review} onAnswer={(ok) => { if (!d.quiz!.review) api().storyAnswerQuiz(d.quiz!.id, ok); }} onDone={d.closeQuiz} />}
      {d.clue && <ClueCard clueId={d.clue} onClose={d.closeClue} />}
      {pickerTask && picker && <VariantTray task={pickerTask} selected={picker.selected} free={picker.free} onSelect={selectVariant} onCancel={cancelPicker} onConfirm={confirmPicker} />}
      {confirmTask && <ConfirmTask task={LIVING_TASK_BY_ID[confirmTask]} onCancel={() => setConfirmTask(null)} onConfirm={() => { const id = confirmTask; setConfirmTask(null); void execute(id); }} />}
      {needStars && <NeedStars task={LIVING_TASK_BY_ID[needStars]} bal={bal} onClose={() => setNeedStars(null)} onLearn={() => nav('/learn')} />}
      {panel === 'board' && <MissionBoard m={m} onClose={() => setPanel(null)} onRun={openTask} onLearn={() => nav('/learn')} />}
      {panel === 'clues' && <CluesPanel m={m} onClose={() => setPanel(null)} />}
      {panel === 'story' && <StoryLogPanel m={m} onClose={() => setPanel(null)} onReplay={replay} />}
    </div>
  );
}

function AIcon({ name, size }: { name: string; size: number }) {
  return <img src={assetUrl(`a/icon-${name}`)} alt="" aria-hidden width={size} height={size} className="a-icon" style={{ width: size, height: size }} draggable={false} />;
}

function HudIcon({ children, label, onClick, testId, badge }: { children: React.ReactNode; label: string; onClick: () => void; testId: string; badge?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} data-testid={testId} className="relative mansion-chip rounded-full w-11 h-11 grid place-items-center text-xl">
      {children}
      {badge ? <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#4FA43A] text-white text-[11px] font-black grid place-items-center border-2 border-white">{badge}</span> : null}
    </button>
  );
}
