/**
 * 홈 — 전체 저택 아이소메트릭 맵 (승인된 1단계 시안: docs/mockups/stage1)
 * - 진행 중인 공간 금색 강조, 잠긴 공간은 옅은 구름·안개, 공간을 누르면 확대 연출 후 공간 화면으로
 * - 거실은 리모델링 진행도만큼 바랜 색에서 원래 색으로 돌아온다
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/store/app';
import { assetUrl } from '@/game/assets';
import MAP_VARIANTS_JSON from '@/game/mansion/mapVariants.json';

const MAP_VARIANTS = MAP_VARIANTS_JSON as Record<string, Record<string, { key: string; x: number; y: number; w: number; h: number }>>;
import { Portrait } from '@/game/mansion/Sprites';
import { starBalance, starsEarned } from '@/domain/mansion/logic';
import { MAP_ROOMS, MAP_ROOM_BY_ID, MAP_SIZE, roomProgress, roomUnlocked, type MapRoomId } from '@/game/mansion/mansionMap';
import { sfx } from '@/lib/sfx';

const [W, H] = MAP_SIZE;
const pts = (p: [number, number][]) => p.map((q) => q.join(',')).join(' ');
const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });
const center = (p: [number, number][]) => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length] as const;

function AIcon({ name, size, className }: { name: string; size: number; className?: string }) {
  return <img src={assetUrl(`a/icon-${name}`)} alt="" aria-hidden className={`a-icon ${className ?? ''}`} style={{ width: size, height: size }} draggable={false} />;
}

export function MapScreen() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: MapRoomId } };
  const m = useApp((s) => s.mansion);
  const [zoom, setZoom] = useState<{ room: MapRoomId; phase: 'in' | 'out' } | null>(loc.state?.from ? { room: loc.state.from, phase: 'out' } : null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number>();
  useEffect(() => { if (zoom?.phase === 'out') { const t = window.setTimeout(() => setZoom(null), 30); return () => clearTimeout(t); } }, [zoom]);
  const flash = (t: string) => { setToast(t); clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), 2600); };

  const living = roomProgress(m, 'living');
  const bal = starBalance(m);
  const level = 1 + Math.floor(starsEarned(m) / 3);
  const current: MapRoomId = living.complete ? 'kitchen' : 'living';
  const fade = 1 - living.done / Math.max(1, living.total); // 거실 바랜 정도

  const open = (id: MapRoomId) => {
    const r = MAP_ROOM_BY_ID[id];
    sfx('tap');
    if (!roomUnlocked(m, id)) {
      const prev = r.after ? MAP_ROOM_BY_ID[r.after].name : '';
      flash(`${r.name}은(는) 잠겨 있어요. ${prev} 리모델링을 완성하면 열려요.`);
      return;
    }
    if (!r.playable) { flash(`${r.name}이(가) 열렸어요! ${r.chapter} 이야기와 리모델링은 준비 중이에요.`); return; }
    setZoom({ room: id, phase: 'in' });
    window.setTimeout(() => nav(`/mansion/${id}`), 520);
  };

  const z = zoom ? (() => { const c = center(MAP_ROOM_BY_ID[zoom.room].poly); return { transform: zoom.phase === 'in' ? 'scale(2.1)' : 'scale(2.1)', transformOrigin: `${(c[0] / W) * 100}% ${(c[1] / H) * 100}%` }; })() : { transform: 'scale(1)', transformOrigin: '50% 50%' };

  return (
    <div className="fixed inset-0 overflow-hidden mansion-ui bg-[radial-gradient(ellipse_at_center,#56683A_0%,#33401F_70%,#262F17_100%)]" data-testid="map-screen">
      {/* 맵: 전체가 보이도록 맞춤 (16:9, 남는 가장자리는 정원 톤) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `min(100vw, ${(100 * W) / H}vh)`, aspectRatio: `${W} / ${H}` }}>
        <div className="absolute inset-0 transition-transform duration-500 ease-in-out" style={z} data-testid="map-world">
          <img src={assetUrl('map/mansion')} alt="하루의 저택 전체 모습" className="absolute inset-0 w-full h-full select-none" draggable={false} />
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" aria-hidden>
            <defs>
              <filter id="mblur"><feGaussianBlur stdDeviation="14" /></filter>
              <filter id="mglow"><feGaussianBlur stdDeviation="6" /></filter>
              <clipPath id="mliving"><polygon points={pts(MAP_ROOM_BY_ID.living.poly)} /></clipPath>
              <radialGradient id="mvig" cx="50%" cy="48%" r="70%"><stop offset="60%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#1c140c" stopOpacity=".5" /></radialGradient>
            </defs>
            {/* 거실: 진행도만큼 바랜 색 → 원래 색 */}
            {fade > 0 && <image href={assetUrl('map/mansion')} width={W} height={H} clipPath="url(#mliving)" opacity={0.35 + 0.65 * fade} style={{ filter: 'grayscale(.4) sepia(.45) brightness(.82) contrast(.95)' }} data-testid="map-living-dust" />}
            {/* 거실에서 고른 디자인(소파·안락의자·커튼·러그)을 맵에도 — 같은 저장 데이터 */}
            {Object.entries(MAP_VARIANTS).map(([tid, vs]) => {
              const r = m.renovations[tid];
              const p = r?.status === 'completed' && r.selectedVariantId ? vs[r.selectedVariantId] : undefined;
              return p ? <image key={tid} href={assetUrl(p.key)} x={p.x} y={p.y} width={p.w} height={p.h} data-testid={`map-variant-${tid}`} data-variant={r!.selectedVariantId} /> : null;
            })}
            {/* 잠긴 공간: 옅은 안개 */}
            {MAP_ROOMS.filter((r) => !roomUnlocked(m, r.id)).map((r) => <polygon key={r.id} points={pts(r.poly)} fill="#F3E7D6" opacity=".42" filter="url(#mblur)" />)}
            {/* 현재 공간 강조 */}
            <polygon points={pts(MAP_ROOM_BY_ID[current].poly)} fill="none" stroke="#FFD86B" strokeWidth="12" filter="url(#mglow)" className="map-pulse" />
            <polygon points={pts(MAP_ROOM_BY_ID[current].poly)} fill="none" stroke="#FFF1C2" strokeWidth="3.5" />
            <rect width={W} height={H} fill="url(#mvig)" />
          </svg>
          {/* 구름 (잠긴 공간) */}
          {MAP_ROOMS.filter((r) => !roomUnlocked(m, r.id)).flatMap((r) => r.clouds.map(([n, x, y, w], i) => (
            <img key={`${r.id}-${i}`} src={assetUrl(`map/cloud-${n}`)} alt="" aria-hidden data-testid={`cloud-${r.id}`} className="absolute pointer-events-none map-cloud"
              style={{ ...pct(x, y), width: `${(w / W) * 100}%`, opacity: 0.58, animationDelay: `${(i * 1.7) % 5}s` }} />
          )))}
          {/* 공간 버튼 */}
          {MAP_ROOMS.map((r) => {
            const unlocked = roomUnlocked(m, r.id);
            const p = roomProgress(m, r.id);
            const isCur = r.id === current;
            return (
              <button key={r.id} type="button" onClick={() => open(r.id)} data-testid={`map-room-${r.id}`} data-unlocked={unlocked ? '1' : '0'}
                aria-label={`${r.name} — ${unlocked ? (r.playable ? `리모델링 ${p.done}/${p.total}` : '준비 중') : '잠김'}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 mansion-chip rounded-full px-3 min-h-[40px] flex items-center gap-1.5 font-extrabold text-[#5A3B22] whitespace-nowrap ${isCur ? 'text-base border-[3px]' : 'text-sm'}`}
                style={{ ...pct(r.label[0], r.label[1]), ...(isCur && !r.playable ? { background: 'linear-gradient(180deg,#F3D58C,#DDB467)', borderColor: '#fff' } : {}) }}>
                {!unlocked && <AIcon name="lock" size={20} />}
                {r.name}
                {r.playable && <span className="text-xs font-bold text-[#A0835F]">{p.complete ? '완성 ✓' : `${p.done}/${p.total}`}</span>}
                {unlocked && !r.playable && <span className="text-xs font-bold text-[#7A5A3A]">준비 중</span>}
                {isCur && r.playable && <span className="grid place-items-center w-6 h-6 rounded-full bg-[#C8452F] text-white text-xs font-black border-2 border-white">!</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none z-30" style={{ padding: 'max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto mansion-chip rounded-[24px] pl-1 pr-4 py-1 flex items-center gap-2">
            <Portrait sheet="mansion/portrait-haru" expr="normal" size={46} className="rounded-full bg-[#F1E2C4] border-2 border-[#C9A46A]" />
            <div className="leading-tight">
              <p className="text-[11px] font-bold text-[#A0835F]">하루의 저택 · Lv.{level}</p>
              <p className="text-sm font-extrabold text-[#4A3220] mansion-title">{living.complete ? 'CH.02 주방의 암호' : 'CH.01 낡은 저택의 시작'}</p>
              <div className="flex items-center gap-1.5 mt-0.5"><div className="h-1.5 w-28 rounded-full bg-[#E8D8BA] overflow-hidden"><div className="h-full bg-[#7E9A6A]" style={{ width: `${(living.done / living.total) * 100}%` }} /></div><span className="text-[10px] font-bold text-[#7A5A3A]" data-testid="map-progress">거실 {living.done}/{living.total}</span></div>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button type="button" onClick={() => nav('/learn')} className="mansion-chip rounded-full pl-2 pr-2 min-h-[44px] flex items-center gap-1 font-black text-[#7A4E10] text-lg" data-testid="map-stars" aria-label={`보유 별 ${bal}개 · 학습으로 별 모으기`}>
              <AIcon name="sparkle" size={28} />{bal}<span className="ml-1 grid place-items-center w-6 h-6 rounded-full bg-[#7E9A6A] text-white text-base leading-none">+</span>
            </button>
            <button type="button" onClick={() => nav('/mansion/settings')} aria-label="설정" data-testid="map-settings" className="mansion-chip rounded-full w-11 h-11 grid place-items-center"><AIcon name="gear" size={28} /></button>
          </div>
        </div>

        {/* 왼쪽 세로 메뉴 */}
        <nav aria-label="메인 메뉴" className="pointer-events-auto absolute left-[max(10px,env(safe-area-inset-left))] top-1/2 -translate-y-1/2 flex flex-col gap-2 mt-4">
          <MenuBtn icon="books" label="영어 학습" onClick={() => nav('/learn')} testId="menu-learn" />
          <MenuBtn icon="scroll" label="퀘스트" onClick={() => flash('퀘스트 화면은 다음 단계(4단계)에서 열려요. 지금은 미션 보드에서 리모델링 미션을 확인할 수 있어요.')} testId="menu-quests" soon />
          <MenuBtn icon="quill" label="학습 기록" onClick={() => nav('/learn/records')} testId="menu-records" />
          <MenuBtn icon="photo" label="MY" onClick={() => nav('/my')} testId="menu-my" />
        </nav>

        {/* 하단 공간 선택 */}
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-[max(8px,env(safe-area-inset-bottom))] mansion-panel rounded-[20px] p-1.5 flex gap-1.5" role="tablist" aria-label="공간 선택">
          {MAP_ROOMS.map((r) => {
            const unlocked = roomUnlocked(m, r.id);
            const p = roomProgress(m, r.id);
            const on = r.id === current;
            return (
              <button key={r.id} type="button" role="tab" aria-selected={on} onClick={() => open(r.id)} data-testid={`room-tab-${r.id}`}
                className={`w-[min(13vw,92px)] h-[54px] rounded-2xl flex flex-col items-center justify-center text-[13px] font-extrabold border-2 ${on ? 'bg-gradient-to-b from-[#F3D58C] to-[#DDB467] border-white shadow-[0_0_0_2px_#C99A45] text-[#4A2E12]' : unlocked ? 'bg-[#FFF8EA] border-[#E3CFA6] text-[#6B4A2E]' : 'bg-[#E9DFCD] border-[#E3CFA6] text-[#9C8A70]'}`}>
                <span className="flex items-center gap-1">{!unlocked && <AIcon name="lock" size={14} />}{r.name}</span>
                <span className="text-[10px] font-bold">{r.playable ? (p.complete ? '완성' : '진행 중') : unlocked ? '준비 중' : '잠김'}</span>
              </button>
            );
          })}
        </div>

        {/* 다음 목표 */}
        <button type="button" onClick={() => open(current)} data-testid="map-next" className="pointer-events-auto absolute right-[max(10px,env(safe-area-inset-right))] bottom-[max(8px,env(safe-area-inset-bottom))] mansion-panel rounded-[20px] pl-4 pr-2 h-[66px] flex items-center gap-3 max-[1100px]:hidden">
          <span className="text-left leading-tight"><span className="block text-[11px] font-bold text-[#A0835F]">다음 목표</span><span className="block font-black text-[#4A3220] mansion-title">{living.complete ? '주방이 열렸어요!' : '거실을 새롭게 꾸며요!'}</span></span>
          <span className="mansion-btn-gold rounded-2xl w-11 h-11 grid place-items-center text-lg">▶</span>
        </button>
      </div>
      {toast && <div role="status" className="absolute z-40 left-1/2 -translate-x-1/2 top-[max(70px,env(safe-area-inset-top))] mansion-chip rounded-2xl px-4 py-2 text-sm font-bold text-[#5A3B22] max-w-[80%] text-center pop-in" data-testid="toast">{toast}</div>}
    </div>
  );
}

function MenuBtn({ icon, label, onClick, testId, soon }: { icon: string; label: string; onClick: () => void; testId: string; soon?: boolean }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} aria-label={soon ? `${label} (준비 중)` : label}
      className={`mansion-panel rounded-[20px] w-[64px] h-[64px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold text-[#4A3220] ${soon ? 'opacity-75' : ''}`}>
      <AIcon name={icon} size={32} />{label}
    </button>
  );
}
