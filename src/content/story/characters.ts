import type { CharacterProfile } from '@/domain/story/types';

/** 캐릭터 설정 — 외형·성격·말투·표정·동작을 한곳에서 관리 (스프라이트/초상은 같은 SVG 원본에서 생성: scripts/mansion-art) */
export const CHARACTERS: Record<string, CharacterProfile> = {
  haru: {
    id: 'haru', name: '하루', role: '주인공 · 저택 상속자',
    look: '갈색 긴 웨이브 머리와 분홍 리본, 흰 블라우스에 세이지색 앞치마 원피스, 갈색 가방과 부츠. (시안 A)',
    personality: '현실적이고 호기심이 많다. 당황하면 혼잣말이 늘고, 가끔 엉뚱하게 반응한다. 영어는 초보지만 단서를 풀며 자란다.',
    speech: '반말 섞인 구어체 혼잣말, 관리인에게는 존댓말. 속마음은 괄호로 표시.',
    sprite: 'mansion/char-haru', portrait: 'mansion/portrait-haru',
    expressions: ['normal', 'happy', 'surprised', 'suspicious', 'worried', 'thinking'],
    actions: ['idle', 'walk', 'sweep', 'paint', 'repair', 'celebrate'], width: 175, color: '#7E9A6A',
  },
  aubrey: {
    id: 'aubrey', name: '오브리', role: '저택 관리인',
    look: '흰 머리와 콧수염, 둥근 금테 안경, 갈색 연미복에 금색 조끼, 분홍 나비넥타이, 흰 장갑. (시안 A)',
    personality: '친절하고 부지런하다. 전 주인 이야기만 나오면 말을 돌린다. 리모델링 작업을 직접 해 준다.',
    speech: '정중한 하십시오체. 당황하면 "자자!"로 화제를 바꾼다.',
    sprite: 'mansion/char-aubrey', portrait: 'mansion/portrait-aubrey',
    expressions: ['normal', 'happy', 'surprised', 'suspicious', 'worried', 'thinking'],
    actions: ['idle', 'walk', 'sweep', 'paint', 'repair', 'celebrate'], width: 185, color: '#7A4A2E',
  },
  hodu: {
    id: 'hodu', name: '호두', role: '저택 강아지',
    look: '갈색·크림색 털의 카발리에 스패니얼 강아지, 늘어진 귀, 분홍 스카프에 금색 방울. (시안 A)',
    personality: '장난꾸러기. 숨겨진 물건을 귀신같이 찾아내고 중요한 순간에 엉뚱한 행동을 한다.',
    speech: '"멍!", "끼잉…" 같은 울음소리.',
    sprite: 'mansion/char-hodu', portrait: 'mansion/portrait-hodu',
    expressions: ['normal', 'curious', 'happy'],
    actions: ['idle', 'walk', 'sniff', 'celebrate'], width: 145, color: '#C98A4B',
  },
};
