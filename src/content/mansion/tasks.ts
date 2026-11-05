import type { RenovationTask, TaskKind, TaskPhase } from '@/domain/mansion/types';
import { OBJECT_BY_TASK } from './objects';

const v = (id: string, assetKey: string, label: string) => ({ id, assetKey, label });

/**
 * CH.01 거실 리모델링 40개 작업 (docs/stage2/LIVING_40_PLAN.md) — 청소 → 수리 → 가구 → 조명·패브릭 → 소품
 * - ready: 40개 모두 진행 가능 (ready:false 인 작업은 '디자인 준비 중'으로 목록에만 보이고 진행할 수 없다).
 * - 교체형 선택지 첫 번째 = 시안 A v3 원본, 추가형(장식장·거울·벽난로 장식·조각상)은 새 디자인 3종 (scripts/mansion-art/bake_objects.py)
 * - 준비된 작업끼리 순서대로 열린다(앞 작업 완료 → 다음 공개). 선택지 첫 번째 = 시안 A v3 원본.
 * - 거실 완성(= 40개 모두 완료) → CH.02 주방 해금.
 */
type Def = [id: string, phase: TaskPhase, title: string, desc: string, cost: number, ready: boolean, extra?: Partial<RenovationTask>];
const KIND: Record<TaskPhase, TaskKind> = { clean: 'cleanup', repair: 'repair', furniture: 'furniture', lighting: 'furniture', decor: 'finish' };
const ANIM: Record<TaskPhase, RenovationTask['work']['anim']> = { clean: 'clean', repair: 'repair', furniture: 'install', lighting: 'install', decor: 'install' };

const DEFS: Def[] = [
  ['A1', 'clean', '바닥 쓰레기 치우기', '바닥에 흩어진 낙엽과 말린 카펫을 치워요.', 1, true, { requiresEvents: ['prologue'] }],
  ['A2', 'clean', '쌓인 먼지 제거', '바닥·계단·테이블에 쌓인 먼지 더미를 쓸어요.', 1, true],
  ['A3', 'clean', '거미줄 제거', '창 위와 벽 모서리의 거미줄을 걷어요.', 1, true],
  ['A4', 'clean', '오래된 박스 정리', '쌓아 둔 이삿짐 상자와 나무 상자를 치워요.', 1, true],
  ['A5', 'clean', '천으로 덮인 가구 정리', '소파를 덮은 먼지투성이 천을 걷어요.', 1, true],
  ['A6', 'clean', '창문 청소', '뿌연 유리창을 닦아 햇빛이 들어오게 해요.', 1, true],
  ['A7', 'clean', '벽난로 청소', '벽난로에 쌓인 재를 치워요.', 1, true],
  ['B8', 'repair', '벽지 교체', '바래고 벗겨진 벽지를 걷어 내고 새 색으로 칠해요.', 2, true, { requiresEvents: ['ch1-key'],
    variants: [v('wp-flower', 'scene/v3', '크림 석회벽 (원본)'), v('wp-mint', 'scene/var-B8-sage', '세이지 그린'), v('wp-damask', 'scene/var-B8-rose', '더스티 로즈')] }],
  ['B9', 'repair', '바닥재 교체', '닳은 마루를 고치고 바닥 색을 골라요.', 2, true,
    { variants: [v('fl-warm', 'scene/v3', '월넛 헤링본 (원본)'), v('fl-tile', 'scene/var-B9-oak', '라이트 오크'), v('fl-parquet', 'scene/var-B9-dark', '다크 월넛')] }],
  ['B10', 'repair', '창틀 수리', '틀어진 창틀을 고쳐요.', 1, true],
  ['B11', 'repair', '천장 몰딩 수리', '깨진 천장 몰딩을 복원해요.', 1, true],
  ['B12', 'repair', '벽난로 복구', '벽난로를 고쳐 다시 불을 피워요.', 2, true],
  ['B13', 'repair', '계단 난간 수리', '흔들리는 계단 난간을 고쳐요.', 1, true],
  ['B14', 'repair', '정원 문 손질', '낡은 정원 유리문을 고치고 마감 색을 골라요.', 1, true,
    { variants: [v('door-sage', 'scene/v3', '세이지 유리문 (원본)'), v('door-ivory', 'scene/var-B14-ivory', '아이보리 화이트'), v('door-walnut', 'scene/var-B14-walnut', '월넛 원목')] }],
  ['C15', 'furniture', '메인 소파', '거실 중심이 될 소파의 색을 골라요.', 3, true,
    { variants: [v('sofa-pink', 'scene/v3', '와인 체스터필드 (원본)'), v('sofa-green', 'scene/var-C15-sage', '세이지 체스터필드'), v('sofa-cloud', 'scene/var-C15-caramel', '캐러멜 체스터필드')] }],
  ['C16', 'furniture', '안락의자 1', '찢어진 안락의자를 새 의자로 바꿔요.', 2, true,
    { variants: [v('arm-green', 'scene/v3', '모스 그린 벨벳 (원본)'), v('arm-rose', 'scene/var-C16-rose', '로즈 벨벳'), v('arm-brown', 'scene/var-C16-brown', '브라운 가죽')] }],
  ['C17', 'furniture', '안락의자 2', '앞쪽 안락의자도 새 의자로 바꿔요.', 2, true,
    { variants: [v('arm-green', 'scene/v3', '모스 그린 벨벳 (원본)'), v('arm-rose', 'scene/var-C17-rose', '로즈 벨벳'), v('arm-brown', 'scene/var-C17-brown', '브라운 가죽')] }],
  ['C18', 'furniture', '커피 테이블', '낡은 티테이블을 닦고 새로 칠할 색을 골라요.', 2, true,
    { variants: [v('table-wood', 'scene/v3', '월넛 (원본)'), v('table-marble', 'scene/var-C18-oak', '라이트 오크'), v('table-stump', 'scene/var-C18-ebony', '에보니')] }],
  ['C19', 'furniture', '사이드 테이블', '소파 옆 작은 테이블을 바꿔요. 램프와 책은 그대로 올려 둬요.', 2, true,
    { variants: [v('stable-walnut', 'scene/v3', '월넛 사이드 테이블 (원본)'), v('stable-mahogany', 'scene/var-C19-stable-mahogany', '마호가니 원형 테이블'), v('stable-marble', 'scene/var-C19-stable-marble', '대리석 비스트로 테이블')] }],
  ['C20', 'furniture', '수납장', '벽 쪽 좁은 책장을 다른 수납장으로 바꿔요.', 2, true,
    { variants: [v('shelf-ivy', 'scene/v3', '담쟁이 월넛 책장 (원본)'), v('tall-bookcase', 'scene/var-C20-tall-bookcase', '월넛 유리문 책장'), v('tall-cupboard', 'scene/var-C20-tall-cupboard', '세이지 유리 찬장')] }],
  ['C21', 'furniture', '장식장', '주방 문 옆 박스 더미를 치우고 장식장을 둬요.', 3, true,
    { variants: [v('disp-walnut', 'scene/var-C21-disp-walnut', '월넛 유리 장식장'), v('disp-white', 'scene/var-C21-disp-white', '아이보리 아치 장식장'), v('disp-oak', 'scene/var-C21-disp-oak', '오크 진열 찬장')] }],
  ['C22', 'furniture', '콘솔 테이블', '복도 쪽 콘솔 테이블을 바꿔요.', 2, true,
    { variants: [v('console-walnut', 'scene/v3', '월넛 콘솔 (원본)'), v('console-gilt', 'scene/var-C22-console-gilt', '금박 대리석 콘솔'), v('console-cream', 'scene/var-C22-console-cream', '크림 반달 콘솔')] }],
  ['D23', 'lighting', '메인 조명', '꺼진 조명에 다시 불을 밝혀요.', 2, true],
  ['D24', 'lighting', '벽등', '벽난로 옆 벽등을 바꿔요.', 1, true,
    { variants: [v('sconce-twin', 'scene/v3', '크림 갓 쌍등 (원본)'), v('sconce-iron', 'scene/var-D24-sconce-iron', '무쇠 촛대 벽등'), v('sconce-tulip', 'scene/var-D24-sconce-tulip', '튤립 유리 벽등')] }],
  ['D25', 'lighting', '스탠드 조명', '소파 옆에 둘 스탠드를 골라요.', 1, true,
    { variants: [v('lamp-stand', 'a/lamp-shade', '크림 갓 스탠드'), v('lamp-mushroom', 'a/lamp-tiffany', '장미 티파니 램프'), v('lamp-star', 'a/candelabra', '황동 촛대')] }],
  ['D26', 'lighting', '커튼', '창가 커튼의 색을 골라요.', 2, true,
    { variants: [v('cur-wine', 'scene/v3', '와인 벨벳 (원본)'), v('cur-ivory', 'scene/var-D26-ivory', '아이보리'), v('cur-olive', 'scene/var-D26-olive', '올리브 그린')] }],
  ['D27', 'lighting', '메인 러그', '빛바랜 러그를 빨아 무늬 색을 골라요.', 2, true,
    { variants: [v('rug-round', 'scene/v3', '로즈 플로럴 (원본)'), v('rug-check', 'scene/var-D27-sage', '세이지 플로럴'), v('rug-lily', 'scene/var-D27-gold', '골드 플로럴')] }],
  ['D28', 'lighting', '소파 쿠션', '소파 쿠션을 바꿔요.', 1, true,
    { variants: [v('cushion-gold', 'scene/v3', '골드 플로럴 (원본)'), v('cushion-rose', 'scene/var-D28-cushion-rose', '로즈 벨벳'), v('cushion-sage', 'scene/var-D28-cushion-sage', '세이지 자수')] }],
  ['E29', 'decor', '벽 액자', '벽난로 위 액자를 바꿔요.', 1, true,
    { variants: [v('frame-lake', 'scene/v3', '숲속 풍경화 (원본)'), v('frame-roses', 'scene/var-E29-frame-roses', '장미 정물화'), v('frame-ship', 'scene/var-E29-frame-ship', '범선 그림')] }],
  ['E30', 'decor', '탁상시계', '벽난로 위 탁상시계를 바꿔요.', 1, true,
    { variants: [v('clock-walnut', 'scene/v3', '월넛 탁상시계 (원본)'), v('clock-gilt', 'scene/var-E30-clock-gilt', '금장 탁상시계'), v('clock-porcelain', 'scene/var-E30-clock-porcelain', '꽃무늬 도자기 시계')] }],
  ['E31', 'decor', '화병', '벽난로 위 화병을 바꿔요.', 1, true,
    { variants: [v('vase-flower', 'scene/v3', '꽃 도자기 화병 (원본)'), v('vase-porcelain', 'scene/var-E31-vase-porcelain', '청화 백자 항아리'), v('vase-brass', 'scene/var-E31-vase-brass', '황동 손잡이 화병')] }],
  ['E32', 'decor', '꽃 장식', '꽃 장식을 바꿔요.', 1, true,
    { variants: [v('flower-roses', 'scene/v3', '장미 꽃다발 (원본)'), v('flower-lilies', 'scene/var-E32-flower-lilies', '백합과 유칼립투스'), v('flower-wild', 'scene/var-E32-flower-wild', '들꽃과 라벤더')] }],
  ['E33', 'decor', '화분 1', '박스 옆 빈자리에 화분을 둬요.', 1, true,
    { variants: [v('deco-forest', 'a/plant-fern', '고사리 화분'), v('deco-sea', 'a/plant-palm', '황동 야자 화분'), v('deco-star', 'a/china-cabinet', '도자기 장식장')] }],
  ['E34', 'decor', '화분 2', '앞쪽 화분을 바꿔요.', 1, true,
    { variants: [v('plant-palm', 'scene/v3', '야자 화분 (원본)'), v('plant-fig', 'scene/var-E34-plant-fig', '떡갈고무나무'), v('plant-topiary', 'scene/var-E34-plant-topiary', '회양목 토피어리')] }],
  ['E35', 'decor', '책 장식', '테이블 위 책 장식을 바꿔요.', 1, true,
    { variants: [v('books-stack', 'scene/v3', '가죽 책 더미 (원본)'), v('books-glass', 'scene/var-E35-books-glass', '돋보기 올린 책'), v('books-ends', 'scene/var-E35-books-ends', '황동 북엔드')] }],
  ['E36', 'decor', '촛대', '벽난로 위 촛대를 바꿔요.', 1, true,
    { variants: [v('candle-tall', 'scene/v3', '흰 초 촛대 (원본)'), v('candle-silver', 'scene/var-E36-candle-silver', '은 삼지 촛대'), v('candle-wood', 'scene/var-E36-candle-wood', '나무 촛대 한 쌍')] }],
  ['E37', 'decor', '거울', '벽에 거울을 걸어요.', 1, true,
    { variants: [v('mirror-oval', 'scene/var-E37-mirror-oval', '금박 타원 거울'), v('mirror-walnut', 'scene/var-E37-mirror-walnut', '월넛 사각 거울'), v('mirror-sun', 'scene/var-E37-mirror-sun', '햇살 거울')] }],
  ['E38', 'decor', '벽난로 위 장식품', '벽난로 위에 장식품을 둬요.', 1, true,
    { variants: [v('orn-globe', 'scene/var-E38-orn-globe', '황동 천구의'), v('orn-urns', 'scene/var-E38-orn-urns', '도자기 항아리 한 쌍'), v('orn-foodog', 'scene/var-E38-orn-foodog', '청화 사자상 한 쌍')] }],
  ['E39', 'decor', '작은 조각상', '커피 테이블에 작은 조각상을 둬요.', 1, true,
    { variants: [v('statue-bust', 'scene/var-E39-statue-bust', '대리석 흉상'), v('statue-horse', 'scene/var-E39-statue-horse', '청동 말 조각'), v('statue-shepherdess', 'scene/var-E39-statue-shepherdess', '도자기 양치기 소녀')] }],
  ['E40', 'decor', '테이블 장식품', '작은 테이블 위 장식품을 바꿔요.', 1, true,
    { variants: [v('bowl-brass', 'scene/v3', '황동 그릇 (원본)'), v('tray-tea', 'scene/var-E40-tray-tea', '은 찻잔 쟁반'), v('tray-apples', 'scene/var-E40-tray-apples', '사과 나무 쟁반')] }],
];

const readyIds = DEFS.filter((d) => d[5]).map((d) => d[0]);
export const LIVING_TASKS: RenovationTask[] = DEFS.map(([id, phase, title, desc, cost, ready, extra], i) => {
  const prev = readyIds[readyIds.indexOf(id) - 1];
  return {
    id, roomId: 'living', order: i + 1, phase, title, desc, costStars: cost, kind: KIND[phase],
    prerequisiteTaskIds: ready && prev ? [prev] : [],
    slot: id, objectId: OBJECT_BY_TASK[id]?.id, ready,
    work: { spot: [0, 0], facing: 'right', action: phase === 'clean' ? 'sweep' : 'repair', anim: ANIM[phase] },
    ...extra,
  };
});

export const LIVING_TASK_BY_ID: Record<string, RenovationTask> = Object.fromEntries(LIVING_TASKS.map((t) => [t.id, t]));
export const LIVING_TOTAL_COST = LIVING_TASKS.reduce((a, t) => a + t.costStars, 0);
export const LIVING_READY = LIVING_TASKS.filter((t) => t.ready !== false);
export const PHASE_LABEL: Record<TaskPhase, string> = { clean: '청소', repair: '수리', furniture: '가구', lighting: '조명·패브릭', decor: '소품' };
export const PHASES: TaskPhase[] = ['clean', 'repair', 'furniture', 'lighting', 'decor'];
