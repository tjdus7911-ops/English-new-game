import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { WORLD, isoG, up, type Grid, type Pt } from './iso';

export interface CameraApi {
  /** 월드 지점으로 부드럽게 이동 (zoom = 기본 배율 대비 배수). 완료 시 resolve */
  focus: (at: Grid, h?: number, zoom?: number, ms?: number) => Promise<void>;
  reset: (ms?: number) => Promise<void>;
  /** 즉시 마침 (건너뛰기) */
  finish: () => void;
  scale: () => number;
}

interface Cam { x: number; y: number; s: number }

/**
 * 카메라: 드래그 이동 · 핀치/휠 줌 · 이동 범위 제한 · 프로그램 포커스(트윈).
 * 탭과 드래그를 구분해, 드래그한 뒤에는 핫스팟 클릭이 발생하지 않는다.
 */
export const CameraView = forwardRef<CameraApi, { children: ReactNode; home: { at: Grid; h?: number; zoom?: number }; testId?: string; locked?: boolean; insetRight?: number }>(function CameraView({ children, home, testId, locked, insetRight = 0 }, ref) {
  const inset = useRef(insetRight);
  const vp = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const cam = useRef<Cam>({ x: 0, y: 0, s: 0.5 });
  const anim = useRef<{ raf: number; done: () => void } | null>(null);
  /** 오른쪽 패널이 덮는 폭을 뺀 '보이는 영역' */
  const size = () => { const r = vp.current!.getBoundingClientRect(); return { w: Math.max(200, r.width - inset.current), h: r.height }; };
  /** 기본 배율: 거실(약 1500×900 월드 px)이 화면을 채우는 정도 */
  const baseScale = () => { const { w, h } = size(); return Math.max(w / WORLD[0], h / WORLD[1]); };
  const limits = () => { const { w, h } = size(); return { min: Math.max(w / WORLD[0], h / WORLD[1]), max: baseScale() * 3 }; };

  const clamp = (c: Cam): Cam => {
    const { w, h } = size();
    const { min, max } = limits();
    const s = Math.min(max, Math.max(min, c.s));
    const minX = w - WORLD[0] * s, minY = h - WORLD[1] * s;
    return { s, x: Math.min(0, Math.max(minX, c.x)), y: Math.min(0, Math.max(minY, c.y)) };
  };
  const apply = useCallback(() => {
    const c = cam.current;
    if (world.current) world.current.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.s})`;
    if (vp.current) { vp.current.style.setProperty('--cam-s', String(c.s)); vp.current.style.setProperty('--inv', String(Math.min(2.6, 0.72 / c.s))); }
  }, []);
  const target = (p: Pt, s: number): Cam => { const { w, h } = size(); return clamp({ s, x: w / 2 - p[0] * s, y: h / 2 - p[1] * s }); };

  const stop = () => { if (anim.current) { cancelAnimationFrame(anim.current.raf); const d = anim.current.done; anim.current = null; d(); } };
  const tween = (to: Cam, ms: number) => new Promise<void>((resolve) => {
    stop();
    const from = { ...cam.current };
    if (ms <= 0) { cam.current = to; apply(); resolve(); return; }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      cam.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, s: from.s + (to.s - from.s) * e };
      apply();
      if (k < 1) anim.current!.raf = requestAnimationFrame(step);
      else { anim.current = null; resolve(); }
    };
    anim.current = { raf: requestAnimationFrame(step), done: () => { cam.current = to; apply(); resolve(); } };
  });

  useEffect(() => {
    if (inset.current === insetRight) return;
    inset.current = insetRight;
    if (vp.current) { cam.current = target(up(isoG(home.at), home.h ?? 0), baseScale() * (home.zoom ?? 1)); apply(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetRight]);

  useImperativeHandle(ref, () => ({
    focus: (at, h = 0, zoom = 1, ms = 700) => tween(target(up(isoG(at), h), baseScale() * zoom), ms),
    reset: (ms = 700) => tween(target(up(isoG(home.at), home.h ?? 0), baseScale() * (home.zoom ?? 1)), ms),
    finish: stop,
    scale: () => cam.current.s,
  }));

  // 첫 배치 + 화면 크기 변경(회전) 대응: 현재 중심을 유지한 채 다시 맞춤
  useEffect(() => {
    cam.current = target(up(isoG(home.at), home.h ?? 0), baseScale() * (home.zoom ?? 1));
    apply();
    let prev = size();
    const ro = new ResizeObserver(() => {
      const now = size();
      if (!now.w || !now.h) return;
      const c = cam.current;
      const center: Pt = [(prev.w / 2 - c.x) / c.s, (prev.h / 2 - c.y) / c.s];
      const ratio = Math.max(now.w / WORLD[0], now.h / WORLD[1]) / Math.max(0.0001, Math.max(prev.w / WORLD[0], prev.h / WORLD[1]));
      cam.current = target(center, c.s * (Number.isFinite(ratio) && ratio > 0 ? ratio : 1));
      prev = now;
      apply();
    });
    ro.observe(vp.current!);
    return () => { ro.disconnect(); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 제스처 ──
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ moved: boolean; start: Pt; cam: Cam; dist?: number; mid?: Pt } | null>(null);
  const suppressClick = useRef(false);

  const zoomAt = (p: Pt, s: number) => {
    const c = cam.current;
    const wx = (p[0] - c.x) / c.s, wy = (p[1] - c.y) / c.s;
    cam.current = clamp({ s, x: p[0] - wx * s, y: p[1] - wy * s });
    if (cam.current.s !== s) { const s2 = cam.current.s; cam.current = clamp({ s: s2, x: p[0] - wx * s2, y: p[1] - wy * s2 }); }
    apply();
  };
  const local = (e: { clientX: number; clientY: number }): Pt => { const r = vp.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const onDown = (e: React.PointerEvent) => {
    suppressClick.current = false;
    if (locked) return;
    stop();
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    if (pts.length === 1) gesture.current = { moved: false, start: pts[0], cam: { ...cam.current } };
    if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = { moved: true, start: a, cam: { ...cam.current }, dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length >= 2 && g.dist) {
      const [a, b] = pts;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      cam.current = { ...g.cam, x: g.cam.x + (mid[0] - g.mid![0]), y: g.cam.y + (mid[1] - g.mid![1]) };
      zoomAt(mid, g.cam.s * (d / g.dist));
      return;
    }
    const p = pts[0];
    const dx = p[0] - g.start[0], dy = p[1] - g.start[1];
    if (!g.moved && Math.hypot(dx, dy) < 8) return;
    if (!g.moved) { g.moved = true; vp.current?.setPointerCapture(e.pointerId); }
    cam.current = clamp({ ...g.cam, x: g.cam.x + dx, y: g.cam.y + dy });
    apply();
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.moved) suppressClick.current = true;
    if (pointers.current.size === 0) gesture.current = null;
    else { const p = [...pointers.current.values()][0]; gesture.current = { moved: true, start: p, cam: { ...cam.current } }; }
  };
  const onWheel = (e: React.WheelEvent) => {
    if (locked) return;
    stop();
    zoomAt(local(e), cam.current.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  };

  return (
    <div ref={vp} data-testid={testId} className="absolute inset-0 overflow-hidden select-none" style={{ touchAction: 'none', background: '#7FB35E' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
      onClickCapture={(e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false; } }}>
      <div ref={world} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: WORLD[0], height: WORLD[1] }}>{children}</div>
    </div>
  );
});
