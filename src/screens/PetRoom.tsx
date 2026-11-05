/**
 * ⑥ 펫 육성방
 * - 펫 탭 = 쓰다듬기 (Pet Reaction → Love). 연달아 쓰다듬으면 화면 가까이 다가와 부비부비
 * - 먹이 주기: 밥그릇으로 달려가(feed_run) 먹기(eat) → Happy
 * - 놀아주기: 공을 굴리면 쫓아가(follow) 놀기(play) → Excited
 * - 꾸미기: 장식 선택 (착용 미리보기)
 * - 자는 펫 탭 → Wake Up → Yawn
 * - 아래 이전/다음 버튼으로 다른 펫(또는 알)의 방으로 이동 (캐릭터 목록 없음, 방마다 단계·장식 따로 유지)
 * - 알이 있으면 알 방: 학습 진행률·부화시키기
 * 수치 변화(경험치·친밀도·포만감)는 게임 로직 단계에서 연결 — 지금은 연출만.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, Btn, Icon, Panel, Screen, TopHud, icon, toast } from '../ui/kit';
import { go } from '../app/router';
import { PetBrain, type Zone, type Pt } from '../pets/brain';
import { usePetWorld } from '../pets/usePetWorld';
import { PetActor, PetFrame } from '../pets/PetSprite';
import { frameOf, petExtent, petUrl, stageAtlas, preloadAtlas } from '../pets/atlas';
import { ATTRIBUTE_BY_ID, SPECIES_BY_ID } from '../data/species';
import { useFx } from '../ui/fx';
import { isReady, setDeco, useGame, type GamePet } from '../data/store';
import { EggStage } from './EggView';

/** 이동 가능한 러그 — 이 펫의 실제 렌더링 폭을 기준으로 좌우 범위를 줄여 화면·우측 버튼 밖으로 나가지 않게 한다 */
const rugFor = (rx: number): Zone => ({ id: 'rug', poly: Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [768 + Math.cos(a) * rx, 690 + Math.sin(a) * 105] as Pt; }) });
const SAFE_TOP = 215;       // 이름표 아래부터가 캐릭터 안전 영역
const SAFE_LEFT = 40, SAFE_RIGHT = 1250;   // 우측 행동 버튼(x≥1268) 앞까지
const persp = (y: number) => 0.82 + Math.max(0, Math.min(1, (y - 585) / 210)) * 0.3;
const BASE_H = { 1: 320, 2: 380, 3: 430 } as const;
const STAGE_NAME = { 1: '아기', 2: '성장기', 3: '완전체' } as const;
const DECOS = [{ id: 'ribbon', name: '리본 목걸이', slot: '목' }, { id: 'flower_crown', name: '꽃 화관', slot: '머리' }, { id: 'crown', name: '왕관', slot: '머리' }];

type Prop = { kind: 'food' | 'ball'; at: Pt } | null;
type Nuzzle = null | { step: 0 | 1 | 2 | 3; from: Pt };

type RoomRef = { kind: 'egg' | 'pet'; uid: string };

export function PetRoomScreen({ params }: { params: URLSearchParams }) {
  const game = useGame();
  const rooms: RoomRef[] = [...game.eggs.map((e) => ({ kind: 'egg' as const, uid: e.uid })), ...game.pets.map((p) => ({ kind: 'pet' as const, uid: p.uid }))];
  const want = params.get('pet') ?? params.get('egg');
  const idx = Math.max(0, rooms.findIndex((r) => r.uid === want));
  const cur = rooms[idx];
  if (!cur) {
    return (
      <Screen bgName="pet_room" testId="screen-room">
        <TopHud showBack />
        <div className="chip" style={{ position: 'absolute', left: '50%', top: 380, transform: 'translateX(-50%)', fontSize: 34, height: 70, padding: '0 34px' }}>아직 방이 없어요. 알 분양소에서 알을 만나 보세요!</div>
      </Screen>
    );
  }
  const nameOf = (r: RoomRef) => (r.kind === 'egg' ? `${ATTRIBUTE_BY_ID[game.eggs.find((e) => e.uid === r.uid)!.attr].nameKo} 알` : SPECIES_BY_ID[game.pets.find((p) => p.uid === r.uid)!.speciesId].nameKo);
  const prev = rooms[(idx + rooms.length - 1) % rooms.length], next = rooms[(idx + 1) % rooms.length];
  const toRoom = (r: RoomRef) => go('room', r.kind === 'egg' ? { egg: r.uid } : { pet: r.uid }, true);
  const nav = rooms.length > 1 && (
    <div className="room-nav" data-testid="room-nav">
      <button type="button" onClick={() => toRoom(prev)} data-testid="room-prev">〈 {nameOf(prev)} 방</button>
      <button type="button" onClick={() => toRoom(next)} data-testid="room-next">{nameOf(next)} 방 〉</button>
    </div>
  );
  if (cur.kind === 'egg') return <EggRoom key={cur.uid} egg={game.eggs.find((e) => e.uid === cur.uid)!}>{nav}</EggRoom>;
  return <Room key={cur.uid} pet={game.pets.find((p) => p.uid === cur.uid)!}>{nav}</Room>;
}

/** 알 방(펫 하우스): 부화 중이면 학습 진행률·속성 이펙트, 조건을 채우면 부화시키기 */
function EggRoom({ egg, children }: { egg: import('../data/store').Egg; children: React.ReactNode }) {
  const A = ATTRIBUTE_BY_ID[egg.attr];
  const ready = isReady(egg);
  return (
    <Screen bgName="pet_room" className="room-fade" testId="screen-room">
      <EggStage egg={egg} height={380} cx={768} bottom={640} />
      <TopHud showBack hearts />
      <div className="name-plate" data-testid="name-plate"><span style={{ color: A.color }}>●</span> {A.nameKo} 알 <span className="lv">{ready ? '부화 준비 완료' : '부화 중'}</span></div>
      <div className="room-actions">
        <ActionBtn icon="learn_reading" label="학습하기" onClick={() => go('learn')} testId="act-learn" />
        {ready && <ActionBtn icon="heart" label="부화시키기" onClick={() => go('hatch', { egg: egg.uid })} testId="act-hatch" />}
      </div>
      {children}
    </Screen>
  );
}

function Room({ pet, children }: { pet: GamePet; children: React.ReactNode }) {
  const sp = SPECIES_BY_ID[pet.speciesId];
  const attr = ATTRIBUTE_BY_ID[sp.attribute];
  const ext = useMemo(() => petExtent(sp.slug, pet.stage), [sp.slug, pet.stage]);
  // 크기 보정: 가장 큰 모션 프레임(날개·꼬리·뿔 포함)이 화면 안전 영역 안에 들어오는 이동 범위·크기를 계산
  const hCap = BASE_H[pet.stage] * 1.12;
  const rx = Math.max(60, Math.min(520, 768 - SAFE_LEFT - ext.side * hCap, SAFE_RIGHT - 768 - ext.side * hCap));
  const brain = useMemo(() => new PetBrain({ zone: rugFor(rx), at: [768, 700], autonomous: true }), [rx]);
  usePetWorld([brain]);
  useEffect(() => { void preloadAtlas(sp.slug, pet.stage); }, [sp.slug, pet.stage]);
  const fx = useFx();
  const [prop, setProp] = useState<Prop>(null);
  const [nuzzle, setNuzzle] = useState<Nuzzle>(null);
  const deco = pet.deco;
  const [panel, setPanel] = useState<null | 'deco' | 'info'>(null);
  const taps = useRef<number[]>([]);
  const h = Math.min(BASE_H[pet.stage] * persp(brain.y), (brain.y - SAFE_TOP) / Math.max(ext.top, 1));

  // 먹이·공 도착 처리
  useEffect(() => {
    if (!prop) return;
    const reached = !brain.target && (brain.motion === 'eat' || brain.motion === 'play');
    if (reached) {
      // 도착하면 키포즈(eat·play)에 그릇·공이 그려져 있으므로 바닥 소품은 숨긴다
      const t = setTimeout(() => setProp(null), 120);
      if (prop.kind === 'food') fx.burst('crumb', prop.at[0], prop.at[1] - 30, 6);
      else fx.burst('spark', brain.x, brain.y - h * 0.6, 6);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brain.motion, prop]);

  // 꾸미기·상태 팝업: ESC 로 닫기
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(null); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, []);
  const now = () => performance.now();
  const busy = () => !!nuzzle;

  const petIt = () => {
    if (busy()) return;
    setPanel(null);
    if (brain.isSleeping) { brain.request('wake_up', now()); toast('잠에서 깼어요!'); return; }
    brain.request('pet_reaction', now());
    fx.burst('heart', brain.x, brain.y - h * 0.85, 5);
    const t = now();
    taps.current = [...taps.current.filter((x) => t - x < 5000), t];
    if (taps.current.length === 1) toast('계속 쓰다듬으면 가까이 다가와요 ♥');
    if (taps.current.length >= 3) { taps.current = []; startNuzzle(); }
  };
  const feed = () => {
    if (busy()) return;
    setPanel(null);
    const at: Pt = [brain.x < 768 ? brain.x + 260 : brain.x - 260, 720];
    setProp({ kind: 'food', at });
    brain.request('feed_run', now(), { to: [at[0] + (at[0] > brain.x ? -70 : 70), at[1] + 4], then: 'eat' });
  };
  const play = () => {
    if (busy()) return;
    setPanel(null);
    const at: Pt = [brain.x < 768 ? brain.x + 330 : brain.x - 330, 660 + Math.random() * 80];
    setProp({ kind: 'ball', at });
    brain.request('follow', now(), { to: [at[0] + (at[0] > brain.x ? -60 : 60), at[1] + 4], then: 'play' });
  };
  const startNuzzle = () => {
    brain.autonomous = false;
    brain.request('idle', now());
    setNuzzle({ step: 0, from: [brain.x, brain.y] });
  };
  useEffect(() => {
    if (!nuzzle) return;
    const dur = [1300, 1500, 2600, 1300][nuzzle.step];
    if (nuzzle.step === 2) { fx.burst('heart', 768, 360, 10); }
    const t = setTimeout(() => {
      if (nuzzle.step < 3) setNuzzle({ ...nuzzle, step: (nuzzle.step + 1) as 1 }); else { setNuzzle(null); brain.autonomous = true; brain.request('love', now()); }
    }, dur);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuzzle?.step]);

  return (
    <Screen bgName="pet_room" className="room-fade" testId="screen-room">
      {/* 바닥 소품 */}
      {prop && <img src={icon(prop.kind)} alt="" className="room-prop pop" style={{ left: prop.at[0], top: prop.at[1], zIndex: Math.round(prop.at[1]) - 1 }} />}
      {!nuzzle && (
        <>
          <PetActor slug={sp.slug} stage={pet.stage} motion={brain.motion} startedAt={brain.startedAt} height={h} x={brain.x} y={brain.y} facing={brain.facing} onTap={petIt} label={`${sp.nameKo} 쓰다듬기`} deco={deco} />
        </>
      )}
      {nuzzle && <NuzzleOverlay slug={sp.slug} stage={pet.stage} step={nuzzle.step} from={nuzzle.from} h={h} />}
      {fx.layer}

      <TopHud showBack hearts />
      {/* 이름표 */}
      <button type="button" className="name-plate" onClick={() => setPanel(panel === 'info' ? null : 'info')} data-testid="name-plate">
        <span style={{ color: attr.color }}>●</span> {sp.nameKo} <span className="lv">Lv.{pet.level}</span> <span style={{ color: '#FFC83A' }}>★</span>
        <div className="hearts">{[0, 1, 2, 3].map((i) => <span key={i} style={{ opacity: i < pet.hearts ? 1 : .3 }}>♥</span>)}</div>
      </button>
      {/* 행동 버튼 */}
      <div className="room-actions">
        <ActionBtn icon="food" label="먹이 주기" onClick={feed} testId="act-feed" />
        <ActionBtn icon="brush" label="쓰다듬기" onClick={petIt} testId="act-pet" />
        <ActionBtn icon="ball" label="놀아주기" onClick={play} testId="act-play" />
        <ActionBtn icon="ribbon" label="꾸미기" onClick={() => setPanel(panel === 'deco' ? null : 'deco')} testId="act-deco" />
      </div>
      {children}
      {panel && <div className="room-backdrop" onClick={() => setPanel(null)} data-testid="backdrop" />}

      {panel === 'deco' && (
        <Panel title="꾸미기" style={{ left: 40, top: 230, width: 430, zIndex: 1000 }} onClose={() => setPanel(null)} className="room-popup">
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            {DECOS.map((d) => (
              <button key={d.id} type="button" className={`item-card ${deco === d.id ? 'on' : ''}`} onClick={() => { setDeco(pet.uid, deco === d.id ? null : d.id); brain.request('happy', now()); }}>
                <Icon name={d.id} size={74} /><span>{d.name}</span><small>{d.slot} 장식</small>
              </button>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 20, margin: '14px 0 0' }}>선택하면 바로 착용해요 · 다시 누르면 벗어요</p>
        </Panel>
      )}
      {panel === 'info' && (
        <Panel title="펫 상태" style={{ left: 40, top: 230, width: 430, zIndex: 1000 }} onClose={() => setPanel(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px 14px', alignItems: 'center', fontSize: 24 }}>
            <span>속성</span><b style={{ color: attr.color }}>{attr.nameKo}</b>
            <span>성장 단계</span><b>{pet.stage}단계 · {STAGE_NAME[pet.stage]}</b>
            <span>레벨</span><Bar value={62} max={100} color="linear-gradient(#9C6CFF,#6A3FD8)" height={22} label={`Lv.${pet.level}`} />
            <span>친밀도</span><Bar value={pet.hearts} max={4} color="linear-gradient(#FF9CC4,#FF5C9A)" height={22} label="♥" />
            <span>배부름</span><Bar value={70} max={100} color="linear-gradient(#FFD36B,#F5A623)" height={22} />
            <span>기운</span><Bar value={55} max={100} color="linear-gradient(#8BE476,#3E9E30)" height={22} />
            <span>획득일</span><b>2026.11.05</b>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
            <Btn size="sm" variant="purple" onClick={() => go('evolve', { pet: pet.uid })}>진화 보기 ✦</Btn>
            <Btn size="sm" variant="white" onClick={() => go('dex')}>도감</Btn>
          </div>
        </Panel>
      )}
    </Screen>
  );
}

function ActionBtn({ icon, label, onClick, testId }: { icon: string; label: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" className="action-btn" onClick={onClick} data-testid={testId}>
      <Icon name={icon} size={56} /><span>{label}</span>
    </button>
  );
}

/** 근접 교감: 다가오기 → 클로즈업 → 볼 비비기 → 뒤로 물러나기 (cl_* 키포즈 4장) */
function NuzzleOverlay({ slug, stage, step, from, h }: { slug: string; stage: 1 | 2 | 3; step: number; from: Pt; h: number }) {
  const names = ['cl_notice_approach', 'cl_closeup', 'cl_rub_cheek', 'cl_gaze_back_off'];
  const sa = stageAtlas(slug, stage);
  if (step === 0 || step === 3) {
    // 다가오기/물러나기: 키포즈를 크게·작게
    const big = step === 0;
    return (
      <div className="nuzzle-walk" style={{ ['--fx' as string]: `${from[0]}px`, ['--fy' as string]: `${from[1]}px`, animationName: big ? 'nz-in' : 'nz-out' }}>
        <PetFrame slug={slug} stage={stage} frame={names[step]} height={h * 1.15} />
      </div>
    );
  }
  const f = frameOf(slug, stage, names[step]);
  const S = Math.min(640 / Math.max(f.w, f.h), 1.6); // 원본 해상도를 넘겨 키우지 않음(흐림 방지)
  return (
    <div className="nuzzle-close">
      <div className={`nz-lens ${step === 2 ? 'rub' : 'zoom'}`} style={{ width: f.w * S, height: f.h * S, backgroundImage: `url(${petUrl(sa.atlas)})`, backgroundSize: `${sa.size[0] * S}px ${sa.size[1] * S}px`, imageRendering: "auto", backgroundPosition: `${-f.x * S}px ${-f.y * S}px` }} />
      <div className="nz-glow" />
    </div>
  );
}
