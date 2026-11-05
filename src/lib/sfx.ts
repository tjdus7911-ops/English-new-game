/** 게임 효과음 — WebAudio 로 즉석 합성(외부 음원 없음). 설정의 '효과음'이 꺼져 있으면 재생하지 않는다. */
import { useApp } from '@/store/app';

type Kind = 'tap' | 'star' | 'work' | 'hammer' | 'complete' | 'reveal' | 'clue' | 'wrong' | 'correct';
let ctx: AudioContext | null = null;

const NOTES: Record<Kind, { f: number[]; d: number; type: OscillatorType; g: number }> = {
  tap: { f: [660], d: 0.06, type: 'triangle', g: 0.08 },
  star: { f: [880, 1320], d: 0.12, type: 'sine', g: 0.1 },
  work: { f: [220, 180], d: 0.09, type: 'square', g: 0.03 },
  hammer: { f: [140], d: 0.07, type: 'square', g: 0.07 },
  complete: { f: [523, 659, 784, 1046], d: 0.11, type: 'triangle', g: 0.09 },
  reveal: { f: [392, 523, 784], d: 0.14, type: 'sine', g: 0.08 },
  clue: { f: [659, 880, 988, 1318], d: 0.13, type: 'sine', g: 0.09 },
  wrong: { f: [220, 196], d: 0.14, type: 'sawtooth', g: 0.04 },
  correct: { f: [784, 1046], d: 0.12, type: 'triangle', g: 0.09 },
};

export function sfx(kind: Kind) {
  try {
    if (!useApp.getState().settings.sound || typeof window === 'undefined' || !('AudioContext' in window)) return;
    ctx ??= new AudioContext();
    const n = NOTES[kind];
    let t = ctx.currentTime;
    for (const f of n.f) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = n.type; o.frequency.value = f;
      g.gain.setValueAtTime(n.g, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + n.d + 0.02);
      t += n.d * 0.85;
    }
  } catch { /* 오디오 미지원 환경 */ }
}
