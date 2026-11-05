/**
 * 밸런스 설정 — 코드와 분리된 조정값. 아래 숫자는 모두 '임시값(TBD)'이며 기획 확정 시 이 파일만 바꾼다.
 * 확률·경험치·재화 소모량을 코드 안에 직접 쓰지 않는다.
 */
import type { AttributeId } from './species';

export interface GameConfig {
  /** 부화 확률: 속성별로 A·B·C 가중치 (합이 1일 필요 없음, 비율로 계산) */
  hatchWeights: Record<AttributeId, { A: number; B: number; C: number }>;
  /** 부화 대기 시간(초) — 0 이면 즉시 부화 가능 */
  hatchSeconds: number;
  /** 레벨업 필요 경험치: 레벨 n → n+1 */
  expToNext: (level: number) => number;
  /** 단계별 최대 레벨 */
  levelCap: Record<1 | 2 | 3, number>;
  /** 진화 조건 (1→2, 2→3) */
  evolution: Record<'1to2' | '2to3', { minLevel: number; minIntimacy: number; cost: { coins: number; items?: Record<string, number> } }>;
  /** 상호작용 보상과 하루 상한 (상한 이후에는 반응 애니메이션만 재생) */
  interactions: Record<'feed' | 'pet' | 'play', { exp: number; intimacy: number; dailyLimit: number; cooldownSec: number }>;
  intimacyMax: number;
  /** 근접 교감(클로즈업) 해금 친밀도 */
  nuzzleUnlockIntimacy: number;
  /** 상태 수치 감소 (시간당) */
  decayPerHour: { fullness: number; energy: number };
  /** 시작 지급 */
  starter: { eggs: number; coins: number; food: number };
  /** 동시에 화면에 나오는 펫 수 */
  maxActivePets: number;
}

const EVEN = { A: 1, B: 1, C: 1 };

export const CONFIG: GameConfig = {
  hatchWeights: {
    fire: EVEN, water: EVEN, forest: EVEN, lightning: EVEN, moon: EVEN, love: EVEN, snow: EVEN, sun: EVEN, night: EVEN,
  },
  hatchSeconds: 0,
  expToNext: (level) => 20 + level * 10,
  levelCap: { 1: 10, 2: 20, 3: 30 },
  evolution: {
    '1to2': { minLevel: 10, minIntimacy: 30, cost: { coins: 0 } },
    '2to3': { minLevel: 20, minIntimacy: 70, cost: { coins: 0 } },
  },
  interactions: {
    feed: { exp: 6, intimacy: 2, dailyLimit: 5, cooldownSec: 20 },
    pet: { exp: 2, intimacy: 3, dailyLimit: 10, cooldownSec: 5 },
    play: { exp: 4, intimacy: 2, dailyLimit: 6, cooldownSec: 15 },
  },
  intimacyMax: 100,
  nuzzleUnlockIntimacy: 40,
  decayPerHour: { fullness: 4, energy: 3 },
  starter: { eggs: 1, coins: 0, food: 10 },
  maxActivePets: 3,
};
