/** 하트·반짝이 파티클 */
import { useCallback, useState } from 'react';

export interface FxItem { id: number; kind: 'heart' | 'spark' | 'crumb'; x: number; y: number; dx: number; delay: number; glyph?: string }
let seq = 0;

export function useFx() {
  const [items, setItems] = useState<FxItem[]>([]);
  const burst = useCallback((kind: FxItem['kind'], x: number, y: number, n = 6, glyph?: string) => {
    const add: FxItem[] = Array.from({ length: n }, (_, i) => ({ id: ++seq, kind, x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 30, dx: (Math.random() - 0.5) * 140, delay: i * 70, glyph }));
    setItems((s) => [...s, ...add]);
    setTimeout(() => setItems((s) => s.filter((f) => !add.includes(f))), 1400 + n * 70);
  }, []);
  const layer = (
    <div className="fx-layer">
      {items.map((f) => (
        <span key={f.id} className={`fx-${f.kind}`} style={{ left: f.x, top: f.y, animationDelay: `${f.delay}ms`, ['--dx' as string]: `${f.dx}px` }}>
          {f.glyph ?? (f.kind === 'heart' ? '♥' : f.kind === 'spark' ? '✦' : '•')}
        </span>
      ))}
    </div>
  );
  return { burst, layer };
}
