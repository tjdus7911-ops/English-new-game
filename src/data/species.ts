/**
 * EGG ISLAND — 펫 종 등록부 (9속성 × 3종 = 27종)
 * 새 펫 추가: 1) Figma 시트를 art/pets/source/{slug}.webp 로 내보내기  2) build_pet_assets.py 의 PET_ORDER 에 slug 추가
 *            3) 아래 SPECIES 에 한 줄 추가 — 코드 수정 없이 도감·부화·애니메이션에 자동 반영된다.
 */
export type AttributeId = 'fire' | 'water' | 'forest' | 'lightning' | 'moon' | 'love' | 'snow' | 'sun' | 'night';
export type StageNo = 1 | 2 | 3;
/** 몸집 유형 — 이동 속도·표시 크기·충돌 반경에 쓰인다 */
export type BodyType = 'small' | 'quad' | 'tall' | 'heavy' | 'bird' | 'flyer' | 'serpent';

export interface Attribute { id: AttributeId; nameKo: string; color: string; eggFile: string }
export interface Species {
  id: string;            // PET_{ATTR}_{A|B|C}
  slug: string;          // 에셋 폴더 이름
  attribute: AttributeId;
  nameKo: string;
  body: BodyType;
  /** 단계별 표시 높이 배율 (S1 기준 1) */
  stageScale: [number, number, number];
}

export const ATTRIBUTES: Attribute[] = [
  { id: 'fire', nameKo: '불꽃', color: '#FF7A3D', eggFile: 'eggs/fire.webp' },
  { id: 'water', nameKo: '물결', color: '#3DA9FF', eggFile: 'eggs/water.webp' },
  { id: 'forest', nameKo: '숲', color: '#5DBB4A', eggFile: 'eggs/forest.webp' },
  { id: 'lightning', nameKo: '번개', color: '#FFC928', eggFile: 'eggs/lightning.webp' },
  { id: 'moon', nameKo: '달빛', color: '#7B6CFF', eggFile: 'eggs/moon.webp' },
  { id: 'love', nameKo: '사랑', color: '#FF7DB4', eggFile: 'eggs/love.webp' },
  { id: 'snow', nameKo: '눈꽃', color: '#8FD3FF', eggFile: 'eggs/snow.webp' },
  { id: 'sun', nameKo: '태양', color: '#FFB020', eggFile: 'eggs/sun.webp' },
  { id: 'night', nameKo: '밤', color: '#6A3FC8', eggFile: 'eggs/night.webp' },
];

const s = (attribute: AttributeId, letter: 'A' | 'B' | 'C', slug: string, nameKo: string, body: BodyType, stageScale: [number, number, number] = [1, 1.3, 1.6]): Species =>
  ({ id: `PET_${attribute.toUpperCase()}_${letter}`, slug, attribute, nameKo, body, stageScale });

/** 이름은 가칭 — 기획 확정 시 nameKo 만 바꾸면 된다 */
export const SPECIES: Species[] = [
  s('fire', 'A', 'fire_fox', '불꽃 여우', 'quad'),
  s('fire', 'B', 'flame_lizard', '불꽃 도마뱀', 'quad', [1, 1.35, 1.9]),
  s('fire', 'C', 'ember_cat', '불씨 고양이', 'quad', [1, 1.35, 1.7]),
  s('water', 'A', 'aqua_bunny', '물방울 토끼', 'small', [1, 1.35, 1.7]),
  s('water', 'B', 'coral_otter', '산호 수달', 'small'),
  s('water', 'C', 'wave_dragon', '파도 드래곤', 'serpent', [1, 1.35, 1.9]),
  s('forest', 'A', 'sprout_deer', '새싹 사슴', 'tall', [1, 1.4, 1.8]),
  s('forest', 'B', 'moss_guardian', '이끼 수호곰', 'heavy', [1, 1.35, 1.8]),
  s('forest', 'C', 'petal_fox', '꽃잎 여우', 'quad'),
  s('lightning', 'A', 'volt_squirrel', '번개 다람쥐', 'small'),
  s('lightning', 'B', 'spark_chick', '스파크 병아리', 'bird', [1, 1.35, 1.8]),
  s('lightning', 'C', 'spark_puppy', '스파크 강아지', 'quad'),
  s('moon', 'A', 'crescent_cat', '초승달 고양이', 'quad'),
  s('moon', 'B', 'starry_bat', '별빛 박쥐', 'flyer', [1, 1.3, 1.7]),
  s('moon', 'C', 'dream_bunny', '꿈결 토끼', 'small', [1, 1.3, 1.6]),
  s('love', 'A', 'candy_deer', '캔디 사슴', 'tall', [1, 1.4, 1.8]),
  s('love', 'B', 'heart_hamster', '하트 햄스터', 'small', [1, 1.25, 1.5]),
  s('love', 'C', 'ribbon_puppy', '리본 강아지', 'quad'),
  s('snow', 'A', 'snow_fox', '눈꽃 여우', 'quad'),
  s('snow', 'B', 'frost_penguin', '서리 펭귄', 'bird', [1, 1.3, 1.6]),
  s('snow', 'C', 'ice_leopard', '얼음 표범', 'quad', [1, 1.35, 1.8]),
  s('sun', 'A', 'sun_lion', '태양 사자', 'heavy', [1, 1.35, 1.8]),
  s('sun', 'B', 'golden_phoenix', '황금 불사조', 'bird', [1, 1.4, 1.9]),
  s('sun', 'C', 'light_giraffe', '빛의 기린', 'tall', [1, 1.5, 1.9]),
  s('night', 'A', 'shadow_fox', '그림자 여우', 'quad'),
  s('night', 'B', 'dusk_wolf', '황혼 늑대', 'quad', [1, 1.4, 1.8]),
  s('night', 'C', 'night_dragon', '밤의 드래곤', 'serpent', [1, 1.4, 2]),
];

export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map((x) => [x.id, x]));
export const SPECIES_BY_ATTR = (a: AttributeId) => SPECIES.filter((x) => x.attribute === a);
export const ATTRIBUTE_BY_ID: Record<AttributeId, Attribute> = Object.fromEntries(ATTRIBUTES.map((a) => [a.id, a])) as Record<AttributeId, Attribute>;
