/**
 * 연출 감독: 캐릭터 이동·동작, 카메라, 화면 연출(visual), 대화·퀴즈·단서 카드를 비동기 단계로 실행한다.
 * 건너뛰기: 대기·이동·대화는 즉시 끝나고(캐릭터는 목적지로 순간이동), 퀴즈는 건너뛰지 않는다(오답 반복 시 전체 해석 제공).
 * 저장 상태는 여기서 바꾸지 않는다 — 별·미션·단서는 호출 측에서 먼저 커밋하고, 감독은 보여 주기만 한다.
 */
import { useCallback, useRef, useState, type RefObject } from 'react';
import type { CameraApi } from '@/game/mansion/Camera';
import { FOCUS, SPOTS } from '@/game/mansion/mapData';
import { initialVisual, type CharState, type Visual } from '@/game/mansion/MansionWorld';
import { dist, isoG, up, type Grid } from '@/game/mansion/iso';
import type { CharacterId, Expression } from '@/domain/story/types';

export interface DialogState { who: CharacterId | null; expr: Expression; text: string }
export const initialChars = (): CharState[] => [
  { id: 'aubrey', at: SPOTS['aubrey-home'], facing: 'right', action: 'idle' },
  { id: 'haru', at: SPOTS['haru-home'], facing: 'left', action: 'idle' },
  { id: 'hodu', at: SPOTS['hodu-home'], facing: 'left', action: 'idle' },
];

export function useDirector(camera: RefObject<CameraApi | null>, reduceMotion: boolean) {
  const [chars, setChars] = useState<CharState[]>(initialChars);
  const [visual, setVisual] = useState<Visual>(initialVisual);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [quiz, setQuiz] = useState<{ id: string; review: boolean } | null>(null);
  const [clue, setClue] = useState<string | null>(null);
  const [skippable, setSkippable] = useState(false);
  const skip = useRef(false);
  const charsRef = useRef(chars);
  charsRef.current = chars;
  const waiter = useRef<(() => void) | null>(null);
  const fxId = useRef(1);

  const sleep = useCallback((ms: number) => new Promise<void>((r) => {
    if (skip.current || ms <= 0) return r();
    const t = setTimeout(r, reduceMotion ? Math.min(ms, 250) : ms);
    const prev = waiter.current;
    waiter.current = () => { clearTimeout(t); r(); prev?.(); };
  }), [reduceMotion]);

  const setChar = (id: string, p: Partial<CharState>) => setChars((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const place = useCallback((id: string, at: Grid) => setChar(id, { at, action: 'idle' }), []);

  /** 그리드 직선 이동 (초당 2.6칸). 이동 방향으로 좌우 전환 */
  const move = useCallback((id: string, to: Grid) => new Promise<void>((resolve) => {
    const c = charsRef.current.find((x) => x.id === id);
    if (!c) return resolve();
    const from = c.at;
    const d = dist(from, to);
    const sx = isoG(to)[0] - isoG(from)[0];
    const facing = Math.abs(sx) < 4 ? c.facing : sx < 0 ? 'left' : 'right';
    if (skip.current || d < 0.05 || reduceMotion) { setChar(id, { at: to, facing, action: 'idle' }); return resolve(); }
    const ms = (d / 2.6) * 1000;
    const t0 = performance.now();
    setChar(id, { facing, action: 'walk' });
    let raf = 0;
    const step = (t: number) => {
      const k = skip.current ? 1 : Math.min(1, (t - t0) / ms);
      setChar(id, { at: [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k] });
      if (k < 1) raf = requestAnimationFrame(step);
      else { setChar(id, { action: 'idle' }); resolve(); }
    };
    raf = requestAnimationFrame(step);
    const prev = waiter.current;
    waiter.current = () => { cancelAnimationFrame(raf); setChar(id, { at: to, action: 'idle' }); resolve(); prev?.(); };
  }), [reduceMotion]);

  const act = useCallback(async (id: string, action: string, ms: number) => {
    setChar(id, { action });
    await sleep(ms);
    setChar(id, { action: 'idle' });
  }, [sleep]);

  const face = useCallback((id: string, dir: 'left' | 'right') => setChar(id, { facing: dir }), []);

  const cam = useCallback(async (focus: string, zoom?: number, ms = 700) => {
    const f = FOCUS[focus];
    if (!f || !camera.current) return;
    await camera.current.focus(f.at, f.h ?? 0, zoom ?? f.zoom ?? 1.25, skip.current || reduceMotion ? 0 : ms);
  }, [camera, reduceMotion]);
  const camReset = useCallback(async () => { await camera.current?.reset(skip.current || reduceMotion ? 0 : 700); }, [camera, reduceMotion]);

  const fx = useCallback((kind: 'sparkle' | 'dust' | 'get', at: Grid, h = 0) => {
    if (reduceMotion) return;
    const id = fxId.current++;
    setVisual((v) => ({ ...v, fx: [...v.fx, { id, kind, at: up(isoG(at), h) }] }));
    setTimeout(() => setVisual((v) => ({ ...v, fx: v.fx.filter((f) => f.id !== id) })), 1600);
  }, [reduceMotion]);

  const shake = useCallback(async (target: string) => {
    setVisual((v) => ({ ...v, shake: target }));
    await sleep(550);
    setVisual((v) => ({ ...v, shake: null }));
    await sleep(80);
  }, [sleep]);

  /** 대화: 탭(또는 건너뛰기)할 때까지 대기 */
  const say = useCallback((d: DialogState) => new Promise<void>((resolve) => {
    if (skip.current) return resolve();
    setDialog(d);
    waiter.current = () => { setDialog(null); resolve(); };
  }), []);
  const advance = useCallback(() => { const w = waiter.current; waiter.current = null; w?.(); }, []);

  const showQuiz = useCallback((id: string, review: boolean) => new Promise<void>((resolve) => {
    setDialog(null);
    setQuiz({ id, review });
    waiter.current = null;
    quizDone.current = () => { setQuiz(null); resolve(); };
  }), []);
  const quizDone = useRef<(() => void) | null>(null);
  const closeQuiz = useCallback(() => { const f = quizDone.current; quizDone.current = null; f?.(); }, []);

  const showClue = useCallback((id: string) => new Promise<void>((resolve) => {
    setDialog(null);
    setClue(id);
    clueDone.current = () => { setClue(null); resolve(); };
  }), []);
  const clueDone = useRef<(() => void) | null>(null);
  const closeClue = useCallback(() => { const f = clueDone.current; clueDone.current = null; f?.(); }, []);

  const beginSkippable = useCallback(() => { skip.current = false; setSkippable(true); }, []);
  const endSkippable = useCallback(() => { skip.current = false; setSkippable(false); setDialog(null); }, []);
  /** 건너뛰기: 진행 중 대기·이동·대화를 즉시 끝낸다 */
  const requestSkip = useCallback(() => {
    skip.current = true;
    camera.current?.finish();
    let w = waiter.current;
    while (w) { waiter.current = null; w(); w = waiter.current; }
  }, [camera]);
  const skipping = () => skip.current;

  return {
    chars, visual, setVisual, dialog, quiz, clue, skippable,
    sleep, move, place, act, face, cam, camReset, fx, shake, say, advance, showQuiz, closeQuiz, showClue, closeClue,
    beginSkippable, endSkippable, requestSkip, skipping, setChars,
  };
}
export type Director = ReturnType<typeof useDirector>;
