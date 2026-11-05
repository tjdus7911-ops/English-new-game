/**
 * 장식 부착용 앵커 — 펫 이미지의 투명 영역을 읽어 '머리 위'와 '목' 위치를 프레임 안의 비율(0~1)로 구한다.
 * 화면 좌표가 아니라 캐릭터 기준이라서 크기·성장 단계·포즈·좌우 반전이 바뀌어도 장식이 같이 따라간다.
 */
import { useEffect, useState } from 'react';
import type { StageNo } from '../data/species';
import { frameOf, petUrl, stageAtlas } from './atlas';

export interface Anchors { head: [number, number]; neck: [number, number] }
const canvases = new Map<string, Promise<CanvasRenderingContext2D | null>>();
const cache = new Map<string, Anchors | null>();

function ctxFor(url: string) {
  if (!canvases.has(url)) {
    canvases.set(url, new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
          const x = c.getContext('2d', { willReadFrequently: true }); x?.drawImage(im, 0, 0); res(x ?? null);
        } catch { res(null); }
      };
      im.onerror = () => res(null);
      im.src = url;
    }));
  }
  return canvases.get(url)!;
}

export async function computeAnchors(slug: string, stage: StageNo, frame: string): Promise<Anchors | null> {
  const key = `${slug}|${stage}|${frame}`;
  if (cache.has(key)) return cache.get(key)!;
  const sa = stageAtlas(slug, stage);
  const f = frameOf(slug, stage, frame);
  const ctx = await ctxFor(petUrl(sa.atlas));
  let out: Anchors | null = null;
  if (ctx) {
    try {
      const { data } = ctx.getImageData(f.x, f.y, f.w, f.h);
      const W = f.w, H = f.h;
      const rows: number[] = new Array(H).fill(0);
      let x0 = W, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { rows[y]++; if (x < x0) x0 = x; if (x > x1) x1 = x; y1 = y; }
      const bw = Math.max(1, x1 - x0);
      // 얇은 귀 끝·꼬리 끝은 건너뛰고, 폭이 어느 정도 되는 첫 줄을 '머리 윗선'으로 본다
      let top = rows.findIndex((n) => n >= bw * 0.1);
      if (top < 0) top = 0;
      const bh = Math.max(1, y1 - top);
      let sx = 0, sn = 0;
      for (let y = top; y < Math.min(H, top + Math.max(2, Math.round(bh * 0.14))); y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 40) { sx += x; sn++; }
      const hx = sn ? sx / sn : (x0 + x1) / 2;
      const cx = (x0 + x1) / 2;
      out = { head: [hx / W, top / H], neck: [(hx * 0.8 + cx * 0.2) / W, (top + bh * 0.36) / H] };
    } catch { out = null; }
  }
  cache.set(key, out);
  return out;
}

export function useAnchors(slug: string, stage: StageNo, frame: string): Anchors | null {
  const [a, setA] = useState<Anchors | null>(() => cache.get(`${slug}|${stage}|${frame}`) ?? null);
  useEffect(() => {
    let live = true;
    void computeAnchors(slug, stage, frame).then((r) => { if (live) setA(r); });
    return () => { live = false; };
  }, [slug, stage, frame]);
  return a;
}
