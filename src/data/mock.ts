/**
 * UI 시연용 데이터 — 확정 시안(14개 화면)에 보이는 값 그대로.
 * 실제 게임 로직(부화 확률·골드·경험치·보상·진화 조건)은 별도 게임기획서 확정 후 config.ts / 저장 시스템으로 대체한다.
 */
import type { AttributeId, StageNo } from './species';

export const PLAYER = { name: '에그아일랜더', level: 12, exp: 320, expMax: 500, coins: 12540, gems: 780, hearts: 120, islandLevel: 3, studyCount: 56, streak: 7 };

export interface DemoPet { uid: string; speciesId: string; stage: StageNo; level: number; hearts: number }
export const DEMO_PETS: DemoPet[] = [
  { uid: 'p1', speciesId: 'PET_FIRE_A', stage: 2, level: 15, hearts: 3 },
  { uid: 'p2', speciesId: 'PET_FIRE_B', stage: 1, level: 6, hearts: 2 },
  { uid: 'p3', speciesId: 'PET_WATER_A', stage: 1, level: 8, hearts: 2 },
  { uid: 'p4', speciesId: 'PET_WATER_B', stage: 1, level: 4, hearts: 1 },
  { uid: 'p5', speciesId: 'PET_SNOW_A', stage: 2, level: 18, hearts: 3 },
  { uid: 'p6', speciesId: 'PET_FOREST_A', stage: 1, level: 3, hearts: 1 },
  { uid: 'p7', speciesId: 'PET_NIGHT_B', stage: 3, level: 42, hearts: 3 },
  { uid: 'p8', speciesId: 'PET_LOVE_B', stage: 1, level: 5, hearts: 2 },
];
/** 도감: 획득한 종 (시안: 12/27) */
export const DEX_OWNED = new Set([
  'PET_FIRE_A', 'PET_FIRE_B', 'PET_FIRE_C', 'PET_WATER_A', 'PET_WATER_B', 'PET_FOREST_A', 'PET_LIGHTNING_A',
  'PET_LOVE_B', 'PET_SNOW_A', 'PET_SUN_A', 'PET_NIGHT_A', 'PET_NIGHT_B',
]);

export const ATTR_DESC: Record<AttributeId, { title: string; desc: string; theme: string }> = {
  fire: { title: '불꽃 속성', desc: '따뜻하고 용감한\n에너지를 지닌 친구들!', theme: '열정, 활력' },
  water: { title: '물결 속성', desc: '맑고 다정한\n물의 친구들!', theme: '치유, 유연' },
  forest: { title: '숲의 속성', desc: '싱그럽게 자라는\n숲의 친구들!', theme: '생명, 성장' },
  lightning: { title: '번개 속성', desc: '반짝반짝 빠르고\n씩씩한 친구들!', theme: '에너지, 민첩' },
  moon: { title: '달빛 속성', desc: '신비롭고 고요한\n달빛의 친구들!', theme: '신비, 꿈' },
  love: { title: '사랑 속성', desc: '사랑이 넘치는\n다정한 친구들!', theme: '행복, 애정' },
  snow: { title: '눈꽃 속성', desc: '순수하고 차분한\n눈꽃의 친구들!', theme: '순수, 차분' },
  sun: { title: '태양 속성', desc: '밝게 빛나는\n희망의 친구들!', theme: '희망, 빛' },
  night: { title: '밤의 속성', desc: '고귀하고 늠름한\n밤의 친구들!', theme: '어둠, 전설' },
};

export const PROLOGUE = [
  '어서 오너라!\n여기는 특별한 알과 친구들을 만날 수 있는\nEGG ISLAND란다.',
  '함께 영어를 배우며,\n너만의 펫을 키워보지 않겠니?',
  '자, 먼저 너와 함께할\n첫 번째 알을 골라 보거라!',
];

export const LEARN_MENU = [
  { id: 'words', label: '단어 학습', icon: 'learn_words' },
  { id: 'grammar', label: '문법 학습', icon: 'learn_grammar' },
  { id: 'expression', label: '표현 연습', icon: 'learn_expression' },
  { id: 'listening', label: '듣기 훈련', icon: 'learn_listening' },
  { id: 'reading', label: '독서(리딩)', icon: 'learn_reading' },
  { id: 'quiz', label: '퀴즈 챌린지', icon: 'learn_quiz' },
];

export const REWARD = { exp: 300, coins: 120, intimacy: 10 };

export const SHOP_ITEMS = [
  { id: 'food', name: '영양 먹이', price: 100, icon: 'food', cat: 'rec' },
  { id: 'feast', name: '특별 만찬', price: 300, icon: 'feast', cat: 'rec' },
  { id: 'ball', name: '놀이 공', price: 150, icon: 'ball', cat: 'toy' },
  { id: 'ribbon', name: '리본 목걸이', price: 200, icon: 'ribbon', cat: 'deco' },
  { id: 'flower_crown', name: '꽃 crown', price: 250, icon: 'flower_crown', cat: 'deco' },
  { id: 'pet_bed', name: '마법 펫 침대', price: 500, icon: 'pet_bed', cat: 'island' },
  { id: 'feather_toy', name: '깃털 장난감', price: 180, icon: 'feather_toy', cat: 'toy' },
  { id: 'brush', name: '반짝 빗', price: 120, icon: 'brush', cat: 'rec' },
  { id: 'seed', name: '마법 새싹', price: 220, icon: 'seed', cat: 'island' },
  { id: 'signpost', name: '섬 이정표', price: 160, icon: 'signpost', cat: 'island' },
];
export const INVENTORY = [
  { id: 'food', name: '영양 먹이', count: 12, icon: 'food' },
  { id: 'ball', name: '놀이 공', count: 2, icon: 'ball' },
  { id: 'ribbon', name: '리본 목걸이', count: 1, icon: 'ribbon' },
  { id: 'brush', name: '반짝 빗', count: 1, icon: 'brush' },
];

export const DAILY_MISSIONS = [
  { id: 'm1', label: '영어 학습 3회 완료하기', cur: 3, max: 3, icon: 'learn_reading' },
  { id: 'm2', label: '펫에게 먹이 주기', cur: 1, max: 1, icon: 'paw' },
  { id: 'm3', label: '퀴즈 5문제 맞히기', cur: 5, max: 5, icon: 'exp' },
];
export const ACHIEVEMENTS = [
  { id: 'a1', label: '첫 번째 알 부화하기', cur: 1, max: 1, icon: 'chest' },
  { id: 'a2', label: '펫 10마리 모으기', cur: 8, max: 10, icon: 'dex' },
  { id: 'a3', label: '펫 3단계 진화시키기', cur: 1, max: 1, icon: 'crown' },
  { id: 'a4', label: '7일 연속 학습하기', cur: 7, max: 7, icon: 'calendar' },
  { id: 'a5', label: '도감 27종 완성하기', cur: 12, max: 27, icon: 'trophy' },
];
