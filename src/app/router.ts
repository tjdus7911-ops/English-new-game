/** 해시 라우터 — 정적 호스팅에서 새로고침해도 같은 화면 */
import { useEffect, useState } from 'react';

export type Route =
  | 'title' | 'prologue' | 'egg-select' | 'hatch' | 'island' | 'room' | 'learn' | 'reward'
  | 'evolve' | 'dex' | 'adopt' | 'shop' | 'missions' | 'profile' | 'dev-motions';

export interface Loc { route: Route; params: URLSearchParams }

function parse(): Loc {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, q] = h.split('?');
  const route = (path || 'title') as Route;
  return { route, params: new URLSearchParams(q ?? '') };
}

export function go(route: Route, params?: Record<string, string | number>, replace = false) {
  const q = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : '';
  if (replace) window.location.replace(`#/${route}${q}`);
  else window.location.hash = `/${route}${q}`;
}
export const back = () => window.history.back();

export function useLoc(): Loc {
  const [loc, setLoc] = useState(parse);
  useEffect(() => { const on = () => setLoc(parse()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return loc;
}
