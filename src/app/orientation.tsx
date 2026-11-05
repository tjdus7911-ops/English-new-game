/**
 * 화면 방향 정책
 * - 가로형(16:9 기준): 저택 맵 · 리모델링 미션 · 가구 선택 · 캐릭터 스토리 · 영어 추리 · 단서 수집 · 게임 설정  (/mansion/*)
 * - 세로형(9:16 기준): 단어숲 · 도서관 · 시험장 · 문제 풀이 · 학습 결과 · 오답노트 · 학습 기록  (그 외 전부)
 * Android(Capacitor): 네이티브 ScreenOrientation 으로 고정.
 * 모바일 웹: screen.orientation.lock 을 시도(대부분 전체 화면에서만 허용) → 실패하면 '기기를 돌려 주세요' 대체 UI.
 * 대체 UI 는 화면 위에 덮을 뿐 아래 화면을 언마운트하지 않으므로 학습 진행·별·리모델링 상태가 유지된다.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export type Orientation = 'landscape' | 'portrait';

export function orientationFor(pathname: string): Orientation {
  return pathname === '/mansion' || pathname.startsWith('/mansion/') ? 'landscape' : 'portrait';
}

type CapGlobal = { isNativePlatform?: () => boolean };
export const isNative = () => !!(globalThis as unknown as { Capacitor?: CapGlobal }).Capacitor?.isNativePlatform?.();

/** 방향 고정 시도 결과 */
export async function lockOrientation(o: Orientation): Promise<'native' | 'web' | 'unsupported'> {
  if (isNative()) {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.lock({ orientation: o });
      return 'native';
    } catch { /* 플러그인 없음 → 웹 방식으로 */ }
  }
  try {
    const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (so?.lock) { await so.lock(o); return 'web'; }
  } catch { /* 전체 화면이 아니거나 브라우저 미지원 (iOS Safari 등) */ }
  return 'unsupported';
}

const isHandheld = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 820;
const current = (): Orientation => (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');

function useViewportOrientation() {
  const [o, setO] = useState<Orientation>(() => (typeof window === 'undefined' ? 'portrait' : current()));
  useEffect(() => {
    const h = () => setO(current());
    window.addEventListener('resize', h);
    window.addEventListener('orientationchange', h);
    return () => { window.removeEventListener('resize', h); window.removeEventListener('orientationchange', h); };
  }, []);
  return o;
}

/** 라우트가 바뀔 때마다 방향을 요청하고, 맞지 않으면 회전 안내를 띄운다 */
export function OrientationGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const want = orientationFor(pathname);
  const actual = useViewportOrientation();
  const [dismissed, setDismissed] = useState<Record<Orientation, boolean>>({ landscape: false, portrait: false });
  const [handheld, setHandheld] = useState(isHandheld);
  useEffect(() => { void lockOrientation(want); setHandheld(isHandheld()); }, [want]);
  useEffect(() => {
    document.documentElement.dataset.orientation = want;
    return () => { delete document.documentElement.dataset.orientation; };
  }, [want]);
  const mismatch = handheld && actual !== want && !dismissed[want];
  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && !isNative();
  return (
    <>
      {children}
      {mismatch && (
        <div className="fixed inset-0 z-[200] grid place-items-center p-6 text-center" style={{ background: 'linear-gradient(160deg, #FFF3E2, #F7DCC0)' }} role="alertdialog" aria-label="화면 방향 안내" data-testid="rotate-overlay" data-want={want}>
          <div className="max-w-[340px]">
            <div className="mx-auto w-20 h-20 grid place-items-center">
              <div className="rotate-hint w-12 h-20 rounded-[10px] border-[5px] border-[#6B4A2E] bg-white relative" style={{ transform: want === 'landscape' ? undefined : 'rotate(-90deg)' }}>
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 rounded bg-[#6B4A2E]" />
              </div>
            </div>
            <p className="mt-4 text-lg font-extrabold text-[#4A3220]">{want === 'landscape' ? '기기를 가로로 돌려 주세요' : '기기를 세로로 돌려 주세요'}</p>
            <p className="mt-1 text-sm text-[#7A5A3A]">{want === 'landscape' ? '저택 리모델링은 가로 화면에서 진행돼요.' : '영어 학습은 세로 화면에서 진행돼요.'} 진행 상황은 그대로 저장되어 있어요.</p>
            {canFullscreen && (
              <button type="button" className="mt-4 w-full min-h-[48px] rounded-2xl font-extrabold mansion-btn" data-testid="rotate-fullscreen"
                onClick={async () => { try { await document.documentElement.requestFullscreen(); await lockOrientation(want); } catch { /* 브라우저가 거부 */ } }}>
                전체 화면으로 자동 회전
              </button>
            )}
            <button type="button" className="mt-2 w-full min-h-[44px] rounded-2xl font-bold bg-white border-2 border-[#F2D9B4] text-[#8A6244]" data-testid="rotate-dismiss" onClick={() => setDismissed((d) => ({ ...d, [want]: true }))}>
              이대로 계속하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
