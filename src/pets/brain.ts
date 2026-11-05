/**
 * 펫 행동 상태 머신 (화면·저장과 분리된 순수 로직)
 * - 반복 모션(idle·walk·run·sit·sleep…)과 일회성 모션(감정·상호작용)을 구분
 * - 일회성 모션이 끝나면 def.next 또는 idle 로 복귀
 * - 우선순위가 같거나 높은 요청만 재생 중인 일회성 모션을 끊는다 → 모션 충돌 없음
 * - 자율 모드: 대기 중 확률적으로 걷기·달리기·앉기·둘러보기·감정·잠자기 (행동 연출용 가중치)
 * - 이동은 지정된 구역(볼록 다각형) 안에서만 → 건물·장애물을 통과하지 않는다
 */
import { MOTIONS, type MotionId } from '../data/motions';

export type Pt = [number, number];
export interface Zone { id: string; poly: Pt[] }

export function inPoly(p: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function randomIn(poly: Pt[], rnd = Math.random): Pt {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0; i < 60; i++) {
    const p: Pt = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
    if (inPoly(p, poly)) return p;
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

/** 대기 중 다음 행동 가중치 (연출용) */
export const IDLE_CHOICES: [MotionId, number][] = [
  ['walk', 34], ['run', 9], ['sit', 12], ['look_around', 8], ['curious', 4], ['happy', 4], ['yawn', 4], ['tilt', 3],
  ['jump', 3], ['special', 3], ['sleep', 5], ['shy', 2], ['excited', 3], ['idle', 6],
];
const SPEED: Partial<Record<MotionId, number>> = { walk: 55, run: 150, feed_run: 160, follow: 140, turn: 0 };

export interface BrainOpts { zone: Zone; at?: Pt; autonomous?: boolean; speedScale?: number; rnd?: () => number }

export class PetBrain {
  motion: MotionId = 'idle';
  startedAt = 0;
  until = Infinity;
  x: number; y: number;
  facing: 1 | -1 = 1;
  target: Pt | null = null;
  zone: Zone;
  autonomous: boolean;
  private nextThink = 0;
  private afterMove: MotionId | null = null;
  private speedScale: number;
  private rnd: () => number;

  constructor(o: BrainOpts) {
    this.zone = o.zone;
    this.rnd = o.rnd ?? Math.random;
    const p = o.at ?? randomIn(o.zone.poly, this.rnd);
    this.x = p[0]; this.y = p[1];
    this.autonomous = o.autonomous ?? true;
    this.speedScale = o.speedScale ?? 1;
    this.facing = this.rnd() < 0.5 ? 1 : -1;
    this.nextThink = 600 + this.rnd() * 1500;
  }

  get isSleeping() { return this.motion === 'sleep' || this.motion === 'drowsy'; }

  private set(m: MotionId, now: number, loopMs?: number) {
    const d = MOTIONS[m];
    this.motion = m;
    this.startedAt = now;
    this.until = d.loop ? (loopMs !== undefined ? now + loopMs : Infinity) : now + (d.durationMs ?? 1000);
  }

  /** 외부 요청 (터치·먹이 등). 재생 중인 일회성 모션보다 우선순위가 낮으면 무시 */
  request(m: MotionId, now: number, opts?: { loopMs?: number; to?: Pt; then?: MotionId }): boolean {
    const cur = MOTIONS[this.motion];
    const req = MOTIONS[m];
    if (!cur.loop && now < this.until && req.priority < cur.priority) return false;
    if (opts?.to) {
      this.goto(opts.to, m, now, opts.then ?? null);
      return true;
    }
    this.target = null; this.afterMove = null;
    this.set(m, now, opts?.loopMs);
    return true;
  }

  goto(to: Pt, moveMotion: MotionId, now: number, then: MotionId | null = null) {
    const p: Pt = inPoly(to, this.zone.poly) ? to : randomIn(this.zone.poly, this.rnd);
    this.target = p;
    this.afterMove = then;
    const face: 1 | -1 = p[0] >= this.x ? 1 : -1;
    if (face !== this.facing && moveMotion !== 'feed_run' && moveMotion !== 'follow') {
      this.facing = face;
      this.set('turn', now);
      this.pendingMove = moveMotion;
      return;
    }
    this.facing = face;
    this.set(moveMotion, now);
  }
  private pendingMove: MotionId | null = null;

  /** 매 프레임 호출. dt(ms) */
  tick(now: number, dt: number) {
    const d = MOTIONS[this.motion];
    // 이동
    if (this.target && (d.moving)) {
      if (this.motion === 'turn') { /* 제자리 회전 */ } else {
        const sp = (SPEED[this.motion] ?? 60) * this.speedScale * (dt / 1000);
        const dx = this.target[0] - this.x, dy = this.target[1] - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= sp) {
          this.x = this.target[0]; this.y = this.target[1]; this.target = null;
          const then = this.afterMove; this.afterMove = null;
          this.set(then ?? 'idle', now, then === 'sit' ? 3000 + this.rnd() * 3000 : undefined);
          this.nextThink = now + 800 + this.rnd() * 1800;
          return;
        }
        this.x += (dx / dist) * sp; this.y += (dy / dist) * sp;
        if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
      }
    }
    // 일회성·시간 제한 모션 종료
    if (now >= this.until) {
      if (this.motion === 'turn' && this.pendingMove) { const m = this.pendingMove; this.pendingMove = null; this.set(m, now); return; }
      if (this.motion === 'sleep') { this.set('wake_up', now); return; }
      if (this.motion === 'sit' || this.motion === 'idle') { this.set('idle', now); this.nextThink = now + 1200 + this.rnd() * 2000; return; }
      const next = d.next ?? 'idle';
      this.set(next, now, next === 'sleep' ? 7000 + this.rnd() * 6000 : undefined);
      if (next === 'idle') this.nextThink = now + 1000 + this.rnd() * 2200;
      return;
    }
    // 자율 행동
    if (this.autonomous && this.motion === 'idle' && now >= this.nextThink) this.think(now);
  }

  private think(now: number) {
    const total = IDLE_CHOICES.reduce((a, [, w]) => a + w, 0);
    let r = this.rnd() * total;
    let pick: MotionId = 'idle';
    for (const [m, w] of IDLE_CHOICES) { r -= w; if (r <= 0) { pick = m; break; } }
    if (pick === 'walk' || pick === 'run') {
      const to = randomIn(this.zone.poly, this.rnd);
      this.goto(to, pick, now, this.rnd() < 0.25 ? 'sit' : null);
    } else if (pick === 'sit') this.set('sit', now, 3500 + this.rnd() * 4000);
    else if (pick === 'sleep') this.set('drowsy', now);
    else if (pick === 'idle') { this.nextThink = now + 1500 + this.rnd() * 2000; return; }
    else this.set(pick, now);
    this.nextThink = now + 2500 + this.rnd() * 2500;
  }
}
