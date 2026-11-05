/** 16:9 고정 캔버스(1536×864)를 화면에 맞춰 축소·확대 — 웹·모바일 가로 화면 공통 */
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useLoc } from './router';
import { setToastHandler } from '../ui/kit';
import { TitleScreen } from '../screens/Title';
import { PrologueScreen } from '../screens/Prologue';
import { EggSelectScreen } from '../screens/EggSelect';
import { HatchScreen } from '../screens/Hatch';
import { IslandScreen } from '../screens/Island';
import { PetRoomScreen } from '../screens/PetRoom';
import { LearnHallScreen } from '../screens/LearnHall';
import { RewardScreen } from '../screens/Reward';
import { EvolveScreen } from '../screens/Evolve';
import { DexScreen } from '../screens/Dex';
import { AdoptScreen } from '../screens/Adopt';
import { ShopScreen } from '../screens/Shop';
import { MissionsScreen } from '../screens/Missions';
import { ProfileScreen } from '../screens/Profile';
import { MotionLab } from '../screens/MotionLab';

export const W = 1536, H = 864;

function Stage({ children }: { children: ReactNode }) {
  const [s, setS] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setS(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${s})` }}>{children}</div>
    </div>
  );
}

function Toasts() {
  const [msg, setMsg] = useState<{ t: string; id: number } | null>(null);
  useEffect(() => { setToastHandler((t) => { const id = Date.now(); setMsg({ t, id }); setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), 2200); }); return () => setToastHandler(null); }, []);
  return msg ? <div className="toast" role="status" key={msg.id}>{msg.t}</div> : null;
}

export default function App() {
  const { route, params } = useLoc();
  let screen: ReactNode;
  switch (route) {
    case 'prologue': screen = <PrologueScreen />; break;
    case 'egg-select': screen = <EggSelectScreen />; break;
    case 'hatch': screen = <HatchScreen params={params} />; break;
    case 'island': screen = <IslandScreen />; break;
    case 'room': screen = <PetRoomScreen params={params} />; break;
    case 'learn': screen = <LearnHallScreen />; break;
    case 'reward': screen = <RewardScreen params={params} />; break;
    case 'evolve': screen = <EvolveScreen params={params} />; break;
    case 'dex': screen = <DexScreen />; break;
    case 'adopt': screen = <AdoptScreen />; break;
    case 'shop': screen = <ShopScreen params={params} />; break;
    case 'missions': screen = <MissionsScreen />; break;
    case 'profile': screen = <ProfileScreen params={params} />; break;
    case 'dev-motions': screen = <MotionLab />; break;
    default: screen = <TitleScreen />;
  }
  return <Stage><div className="route" key={route + params.toString()} data-route={route}>{screen}</div><Toasts /></Stage>;
}
