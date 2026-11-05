/** 여러 펫 브레인을 requestAnimationFrame 하나로 갱신 (탭이 숨겨지면 rAF 가 멈춰 자동 정지) */
import { useEffect, useRef, useState } from 'react';
import type { PetBrain } from './brain';

export function usePetWorld(brains: PetBrain[], fps = 30) {
  const [, force] = useState(0);
  const ref = useRef(brains);
  ref.current = brains;
  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      const dt = Math.min(100, t - last); last = t; acc += dt;
      for (const b of ref.current) b.tick(t, dt);
      if (acc >= 1000 / fps) { acc = 0; force((x) => (x + 1) % 1e6); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
}
