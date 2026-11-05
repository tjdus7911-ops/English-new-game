/**
 * ⑥ 펫 육성방
 * - 펫 탭 = 쓰다듬기 (Pet Reaction → Love). 연달아 쓰다듬으면 화면 가까이 다가와 부비부비
 * - 먹이 주기: 밥그릇으로 달려가(feed_run) 먹기(eat) → Happy
 * - 놀아주기: 공을 굴리면 쫓아가(follow) 놀기(play) → Excited
 * - 꾸미기: 장식 선택 (착용 미리보기)
 * - 자는 펫 탭 → Wake Up → Yawn
 * - 아래 목록에서 보유 펫 전환
 * 수치 변화(경험치·친밀도·포만감)는 게임 로직 단계에서 연결 — 지금은 연출만.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, Btn, Icon, Panel, Screen, TopHud, icon, toast } from '../ui/kit';
import { go } from '../app/router';
import { PetBrain, type Zone, type Pt } from '../pets/brain';
import { usePetWorld } from '../pets/usePetWorld';
import { PetActor, PetFrame, PetPortrait } from '../pets/PetSprite';
import { frameOf, petUrl, stageAtlas, preloadAtlas } from '../pets/atlas';
import { DEMO_PETS, type DemoPet } from '../data/mock';
import { ATTRIBUTE_BY_ID, SPECIES_BY_ID } from '../data/species';
import { useFx } from '../ui/fx';

const RUG: Zone = { id: 'rug', poly: Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [768 + Math.cos(a) * 520, 690 + Math.sin(a) * 105] as Pt; }) };
const persp = (y: number) => 0.82 + Math.max(0, Math.min(1, (y - 585) / 210)) * 0.3;
const BASE_H = { 1: 320, 2: 380, 3: 430 } as const;
const STAGE_NAME = { 1: '아기', 2: '성장기', 3: '완전체' } as const;
const DECOS = [{ id: 'ribbon', name: '리본 목걸이' }, { id: 'flower_crown', name: '꽃 화관' }, { id: 'crown', name: '왕관' }];

type Prop = { kind: 'food' | 'ball'; at: Pt } | null;
type Nuzzle = null | { step: 0 | 1 | 2 | 3; from: Pt };

export function PetRoomScreen({ params }: { params: URLSearchParams }) {
  const [uid, setUid] = useState(params.get('pet') ?? DEMO_PETS[0].uid);
  const pet = DEMO_PETS.find((p) => p.uid === uid) ?? DEMO_PETS[0];
  return <Room key={pet.uid} pet={pet} onSwitch={setUid} />;
}

function Room({ pet, onSwitch }: { pet: DemoPet; onSwitch: (uid: string) => void }) {
  const sp = SPECIES_BY_ID[pet.speciesId];
  const attr = ATTRIBUTE_BY_ID[sp.attribute];
  const brain = useMemo(() => new PetBrain({ zone: RUG, at: [768, 700], autonomous: true }), []);
  usePetWorld([brain]);
  useEffect(() => { void preloadAtlas(sp.slug, pet.stage); }, [sp.slug, pet.stage]);
  const fx = useFx();
  const [prop, setProp] = useState<Prop>(null);
  const [nuzzle, setNuzzle] = useState<Nuzzle>(null);
  const [deco, setDeco] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | 'deco' | 'info'>(null);
  const taps = useRef<number[]>([]);
  const h = BASE_H[pet.stage] * persp(brain.y);

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

  const now = () => performance.now();
  const busy = () => !!nuzzle;

  const petIt = () => {
    if (busy()) return;
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
    const at: Pt = [brain.x < 768 ? brain.x + 260 : brain.x - 260, 720];
    setProp({ kind: 'food', at });
    brain.request('feed_run', now(), { to: [at[0] + (at[0] > brain.x ? -70 : 70), at[1] + 4], then: 'eat' });
  };
  const play = () => {
    if (busy()) return;
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

  const idx = DEMO_PETS.findIndex((p) => p.uid === pet.uid);
  return (
    <Screen bgName="pet_room" testId="screen-room">
      {/* 바닥 소품 */}
      {prop && <img src={icon(prop.kind)} alt="" className="room-prop pop" style={{ left: prop.at[0], top: prop.at[1], zIndex: Math.round(prop.at[1]) - 1 }} />}
      {!nuzzle && (
        <>
          <PetActor slug={sp.slug} stage={pet.stage} motion={brain.motion} startedAt={brain.startedAt} height={h} x={brain.x} y={brain.y} facing={brain.facing} onTap={petIt} label={`${sp.nameKo} 쓰다듬기`} />
          {deco && <img src={icon(deco)} alt="" className="deco-badge" style={{ left: brain.x + h * 0.18 * brain.facing, top: brain.y - h * 0.95, zIndex: Math.round(brain.y) + 1 }} />}
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
      {/* 보유 펫 전환 */}
      <div className="pet-switcher">
        <button type="button" className="sw-arrow" aria-label="이전 펫" onClick={() => onSwitch(DEMO_PETS[(idx + DEMO_PETS.length - 1) % DEMO_PETS.length].uid)}>‹</button>
        {DEMO_PETS.map((p) => {
          const s = SPECIES_BY_ID[p.speciesId];
          return <button key={p.uid} type="button" className={`sw-item ${p.uid === pet.uid ? 'on' : ''}`} onClick={() => onSwitch(p.uid)} aria-label={s.nameKo} style={{ borderColor: ATTRIBUTE_BY_ID[s.attribute].color }}><PetPortrait slug={s.slug} stage={p.stage} box={76} /></button>;
        })}
        <button type="button" className="sw-arrow" aria-label="다음 펫" onClick={() => onSwitch(DEMO_PETS[(idx + 1) % DEMO_PETS.length].uid)}>›</button>
      </div>

      {panel === 'deco' && (
        <Panel title="꾸미기" style={{ right: 260, top: 250, width: 420 }} onClose={() => setPanel(null)}>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            {DECOS.map((d) => (
              <button key={d.id} type="button" className={`item-card ${deco === d.id ? 'on' : ''}`} onClick={() => { setDeco(deco === d.id ? null : d.id); brain.request('happy', now()); }}>
                <Icon name={d.id} size={74} /><span>{d.name}</span>
              </button>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 20, margin: '14px 0 0' }}>착용 미리보기 · 보유 아이템 연동은 게임 시스템 단계에서</p>
        </Panel>
      )}
      {panel === 'info' && (
        <Panel title="펫 상태" style={{ left: 40, top: 230, width: 430 }} onClose={() => setPanel(null)}>
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
  const S = 640 / Math.max(f.w, f.h);
  return (
    <div className="nuzzle-close">
      <div className={`nz-lens ${step === 2 ? 'rub' : 'zoom'}`} style={{ width: f.w * S, height: f.h * S, backgroundImage: `url(${petUrl(sa.atlas)})`, backgroundSize: `${sa.size[0] * S}px ${sa.size[1] * S}px`, backgroundPosition: `${-f.x * S}px ${-f.y * S}px` }} />
      <div className="nz-glow" />
    </div>
  );
}
