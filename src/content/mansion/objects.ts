/**
 * 거실 오브젝트 — 리모델링 작업 하나 = 화면 속 오브젝트 하나 (docs/stage2/LIVING_40_PLAN.md, living40-map.png)
 * rect: v3 장면(1536×864) 픽셀 [x, y, w, h], z: 레이어 순서(클수록 앞)
 * 현재 선택 디자인·완료 여부는 저장 데이터(mansion.renovations[taskId])에서 읽는다.
 */
export type ObjectType = 'clutter' | 'surface' | 'fixture' | 'furniture' | 'lighting' | 'fabric' | 'decor';
export interface RoomObject { id: string; roomId: 'living'; type: ObjectType; name: string; rect: [number, number, number, number]; z: number; taskId: string }

const o = (id: string, type: ObjectType, name: string, rect: RoomObject['rect'], z: number, taskId: string): RoomObject => ({ id, roomId: 'living', type, name, rect, z, taskId });

export const LIVING_OBJECTS: RoomObject[] = [
  o('obj-trash', 'clutter', '바닥 쓰레기', [960, 520, 330, 290], 50, 'A1'),
  o('obj-dust', 'clutter', '쌓인 먼지', [830, 380, 190, 146], 40, 'A2'),
  o('obj-cobweb', 'clutter', '거미줄', [405, -10, 120, 138], 60, 'A3'),
  o('obj-boxes', 'clutter', '오래된 박스', [1170, 470, 120, 157], 50, 'A4'),
  o('obj-sofa-cover', 'clutter', '가구 덮개 천', [405, 330, 425, 333], 45, 'A5'),
  o('obj-window-glass', 'fixture', '창유리', [497, 49, 103, 235], 20, 'A6'),
  o('obj-fireplace-ash', 'fixture', '벽난로 재', [258, 300, 134, 132], 25, 'A7'),
  o('obj-wallpaper', 'surface', '벽지', [120, 0, 880, 560], 5, 'B8'),
  o('obj-floor', 'surface', '바닥재', [0, 245, 1536, 619], 4, 'B9'),
  o('obj-window-frame', 'fixture', '창틀', [430, 0, 260, 300], 21, 'B10'),
  o('obj-molding', 'fixture', '천장 몰딩', [120, 0, 880, 70], 22, 'B11'),
  o('obj-fireplace', 'fixture', '벽난로', [200, 300, 270, 230], 24, 'B12'),
  o('obj-stair-rail', 'fixture', '계단 난간', [1240, 150, 296, 570], 30, 'B13'),
  o('obj-door', 'fixture', '정원 문', [0, 240, 130, 360], 23, 'B14'),
  o('obj-sofa', 'furniture', '메인 소파', [418, 390, 382, 235], 40, 'C15'),
  o('obj-armchair-1', 'furniture', '안락의자 1', [265, 575, 165, 170], 42, 'C16'),
  o('obj-armchair-2', 'furniture', '안락의자 2', [430, 675, 195, 185], 48, 'C17'),
  o('obj-coffee-table', 'furniture', '커피 테이블', [630, 525, 228, 170], 44, 'C18'),
  o('obj-side-table', 'furniture', '사이드 테이블', [340, 545, 130, 105], 41, 'C19'),
  o('obj-storage', 'furniture', '수납장', [695, 0, 70, 240], 19, 'C20'),
  o('obj-display-cabinet', 'furniture', '장식장', [880, 230, 120, 190], 35, 'C21'),
  o('obj-console', 'furniture', '콘솔 테이블', [1310, 130, 150, 170], 26, 'C22'),
  o('obj-main-light', 'lighting', '메인 조명', [690, 0, 140, 150], 70, 'D23'),
  o('obj-sconce', 'lighting', '벽등', [195, 90, 245, 150], 27, 'D24'),
  o('obj-stand-lamp', 'lighting', '스탠드 조명', [810, 320, 100, 150], 43, 'D25'),
  o('obj-curtain', 'fabric', '커튼', [430, 0, 260, 300], 22, 'D26'),
  o('obj-rug', 'fabric', '메인 러그', [300, 462, 780, 350], 6, 'D27'),
  o('obj-cushion', 'fabric', '소파 쿠션', [495, 420, 235, 120], 41, 'D28'),
  o('obj-frame', 'decor', '벽 액자', [250, 65, 120, 160], 28, 'E29'),
  o('obj-mantel-clock', 'decor', '탁상시계', [310, 210, 35, 40], 29, 'E30'),
  o('obj-vase', 'decor', '화병', [735, 545, 40, 40], 46, 'E31'),
  o('obj-flowers', 'decor', '꽃 장식', [725, 515, 60, 45], 47, 'E32'),
  o('obj-plant-1', 'decor', '화분 1', [945, 425, 100, 120], 45, 'E33'),
  o('obj-plant-2', 'decor', '화분 2', [300, 620, 110, 120], 43, 'E34'),
  o('obj-books', 'decor', '책 장식', [670, 565, 65, 45], 46, 'E35'),
  o('obj-candle', 'decor', '촛대', [235, 235, 35, 40], 29, 'E36'),
  o('obj-mirror', 'decor', '거울', [770, 60, 60, 140], 28, 'E37'),
  o('obj-mantel-decor', 'decor', '벽난로 위 장식품', [360, 170, 50, 45], 29, 'E38'),
  o('obj-statue', 'decor', '작은 조각상', [625, 740, 60, 60], 49, 'E39'),
  o('obj-table-decor', 'decor', '테이블 장식품', [625, 760, 70, 45], 49, 'E40'),
];
export const OBJECT_BY_ID: Record<string, RoomObject> = Object.fromEntries(LIVING_OBJECTS.map((x) => [x.id, x]));
export const OBJECT_BY_TASK: Record<string, RoomObject> = Object.fromEntries(LIVING_OBJECTS.map((x) => [x.taskId, x]));
