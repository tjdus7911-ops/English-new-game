/**
 * 모션 등록부 — 행동 ID → 키포즈 프레임 + 재생 규칙.
 * 현재 Figma 에셋은 모션당 키포즈 1장(일부 2~4장 연속)이므로, 포즈 교체 + 절차적 트랙(숨쉬기·걸음 바운스·흔들림 등)으로 움직임을 만든다.
 * 실제 프레임 애니메이션 시트가 추가되면 frames 배열만 늘리면 된다(코드 변경 없음).
 */
export type MotionId =
  // 기본 행동
  | 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'wake_up'
  // 감정
  | 'happy' | 'sad' | 'love' | 'yawn' | 'curious' | 'surprised' | 'excited' | 'angry' | 'shy' | 'tilt'
  // 상호작용
  | 'eat' | 'play' | 'pet_reaction' | 'level_up' | 'feed_run' | 'follow' | 'drowsy' | 'cheer' | 'special'
  // 보조
  | 'jump' | 'turn' | 'look_around'
  // 근접 교감 (클로즈업)
  | 'nuzzle';

/** 절차적 트랙 — 키포즈 위에 얹는 변형 (translateY, scale, rotate) */
export type Track = 'breathe' | 'walk' | 'run' | 'hop' | 'shake' | 'wiggle' | 'bounce' | 'sleep' | 'stretch' | 'nod' | 'spin' | 'none';

export interface MotionDef {
  id: MotionId;
  /** 아틀라스 프레임 이름 (build_pet_assets.py 의 셀 이름). 여러 장이면 fps 로 순서 재생 */
  frames: string[];
  fps?: number;
  loop: boolean;
  /** 일회성 모션 길이(ms). loop 이면 무시 */
  durationMs?: number;
  track: Track;
  /** 끝난 뒤 자동 전환 (없으면 idle) */
  next?: MotionId;
  /** 우선순위 — 높은 쪽이 재생 중인 낮은 쪽을 끊는다 */
  priority: number;
  /** 이동 중 재생 가능 */
  moving?: boolean;
  /** 말풍선 감정 아이콘 */
  bubble?: string;
}

const m = (d: MotionDef) => d;

export const MOTIONS: Record<MotionId, MotionDef> = {
  idle: m({ id: 'idle', frames: ['idle'], loop: true, track: 'breathe', priority: 0 }),
  walk: m({ id: 'walk', frames: ['walk'], loop: true, track: 'walk', priority: 1, moving: true }),
  run: m({ id: 'run', frames: ['run'], loop: true, track: 'run', priority: 1, moving: true }),
  sit: m({ id: 'sit', frames: ['sit'], loop: true, track: 'breathe', priority: 1 }),
  sleep: m({ id: 'sleep', frames: ['sleep'], loop: true, track: 'sleep', priority: 1, bubble: 'zzz' }),
  wake_up: m({ id: 'wake_up', frames: ['wake_up'], loop: false, durationMs: 1100, track: 'stretch', next: 'yawn', priority: 3 }),
  look_around: m({ id: 'look_around', frames: ['look_around'], loop: false, durationMs: 1600, track: 'nod', priority: 1 }),
  turn: m({ id: 'turn', frames: ['turn'], loop: false, durationMs: 260, track: 'none', priority: 2, moving: true }),
  jump: m({ id: 'jump', frames: ['jump'], loop: false, durationMs: 700, track: 'hop', priority: 2 }),

  happy: m({ id: 'happy', frames: ['emo_happy'], loop: false, durationMs: 1400, track: 'bounce', priority: 2, bubble: 'happy' }),
  sad: m({ id: 'sad', frames: ['emo_sad'], loop: false, durationMs: 1800, track: 'breathe', priority: 2, bubble: 'sad' }),
  love: m({ id: 'love', frames: ['emo_love'], loop: false, durationMs: 1600, track: 'wiggle', priority: 2, bubble: 'love' }),
  yawn: m({ id: 'yawn', frames: ['emo_yawn'], loop: false, durationMs: 1300, track: 'stretch', priority: 2, bubble: 'sleepy' }),
  curious: m({ id: 'curious', frames: ['emo_curious'], loop: false, durationMs: 1400, track: 'nod', priority: 2, bubble: 'curious' }),
  tilt: m({ id: 'tilt', frames: ['emo_tilt'], loop: false, durationMs: 1200, track: 'nod', priority: 2, bubble: 'curious' }),
  surprised: m({ id: 'surprised', frames: ['emo_surprise'], loop: false, durationMs: 900, track: 'hop', priority: 2, bubble: 'surprise' }),
  excited: m({ id: 'excited', frames: ['emo_excited'], loop: false, durationMs: 1400, track: 'bounce', priority: 2, bubble: 'excited' }),
  angry: m({ id: 'angry', frames: ['emo_angry'], loop: false, durationMs: 1300, track: 'shake', priority: 2, bubble: 'angry' }),
  shy: m({ id: 'shy', frames: ['emo_shy'], loop: false, durationMs: 1500, track: 'wiggle', priority: 2, bubble: 'shy' }),

  pet_reaction: m({ id: 'pet_reaction', frames: ['it_pet_react'], loop: false, durationMs: 1500, track: 'wiggle', next: 'love', priority: 3, bubble: 'love' }),
  feed_run: m({ id: 'feed_run', frames: ['it_feed_run'], loop: true, track: 'run', priority: 3, moving: true }),
  eat: m({ id: 'eat', frames: ['eat'], loop: false, durationMs: 2400, track: 'nod', next: 'happy', priority: 3 }),
  play: m({ id: 'play', frames: ['it_toy_play'], loop: false, durationMs: 2200, track: 'bounce', next: 'excited', priority: 3 }),
  follow: m({ id: 'follow', frames: ['it_follow_light'], loop: true, track: 'run', priority: 3, moving: true }),
  drowsy: m({ id: 'drowsy', frames: ['it_drowsy_rest'], loop: false, durationMs: 2200, track: 'sleep', next: 'sleep', priority: 1, bubble: 'sleepy' }),
  level_up: m({ id: 'level_up', frames: ['it_celebrate_correct'], loop: false, durationMs: 2000, track: 'bounce', next: 'happy', priority: 4, bubble: 'excited' }),
  cheer: m({ id: 'cheer', frames: ['it_cheer_wrong'], loop: false, durationMs: 1600, track: 'nod', priority: 2 }),
  special: m({ id: 'special', frames: ['unique_01'], loop: false, durationMs: 2000, track: 'spin', priority: 2 }),

  nuzzle: m({ id: 'nuzzle', frames: ['cl_notice_approach', 'cl_closeup', 'cl_rub_cheek', 'cl_gaze_back_off'], fps: 0.7, loop: false, durationMs: 5800, track: 'none', priority: 4 }),
};

/** 요청서의 행동 18종 → 모션 */
export const REQUIRED_BEHAVIORS: Record<string, MotionId> = {
  Idle: 'idle', Walk: 'walk', Run: 'run', Sit: 'sit', Sleep: 'sleep', 'Wake Up': 'wake_up',
  Happy: 'happy', Sad: 'sad', Love: 'love', Yawn: 'yawn', Curious: 'curious', Surprised: 'surprised',
  Excited: 'excited', Angry: 'angry', Eat: 'eat', Play: 'play', 'Pet Reaction': 'pet_reaction', 'Level Up': 'level_up',
};

/** 아틀라스에 있는 모든 프레임이 어떤 모션에 쓰이는지 — 미사용 에셋 검사용 */
export const FRAMES_IN_USE = new Set(Object.values(MOTIONS).flatMap((d) => d.frames));
