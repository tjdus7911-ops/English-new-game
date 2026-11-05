import type { Chapter } from '@/domain/story/types';

/** 「수상한 저택의 상속자」 챕터 구성. available=false 인 챕터는 '준비 중'으로만 표시하고 플레이할 수 없다. */
export const CHAPTERS: Chapter[] = [
  { id: 'prologue', order: 0, title: '프롤로그', place: '저택 입구', summary: '이름 모를 사람에게서 온 상속 편지. 관리인 오브리와 강아지 호두를 만난다.', available: true, unlock: { eventsDone: [] }, roomId: 'porch' },
  { id: 'ch1', order: 1, title: 'CH.01 거실의 비밀', place: '거실', summary: '소파 밑 편지, 그림 뒤 열쇠, 벽 속 문양, 그리고 오래된 사진.', available: true, unlock: { eventsDone: ['prologue'] }, roomId: 'living' },
  { id: 'ch2', order: 2, title: 'CH.02 주방의 암호', place: '주방', summary: '전 주인이 남긴 레시피와 암호.', available: false, unlock: { eventsDone: ['ch1-finale'] }, roomId: 'kitchen' },
  { id: 'ch3', order: 3, title: 'CH.03 잠긴 서랍', place: '침실', summary: '잠긴 서랍과 비밀 편지.', available: false, unlock: { eventsDone: ['ch2-finale'] } },
  { id: 'ch4', order: 4, title: 'CH.04 서재의 일기', place: '서재', summary: '저택의 과거가 기록된 일기.', available: false, unlock: { eventsDone: ['ch3-finale'] } },
  { id: 'ch5', order: 5, title: 'CH.05 정원의 상자', place: '정원', summary: '땅속에 묻힌 수상한 상자.', available: false, unlock: { eventsDone: ['ch4-finale'] }, roomId: 'garden' },
  { id: 'ch6', order: 6, title: 'CH.06 봉인된 방', place: '2층', summary: '오랫동안 봉인된 방.', available: false, unlock: { eventsDone: ['ch5-finale'] }, roomId: 'hall' },
];

export const STORY_QUESTION = '전 주인은 왜 하필 하루에게 이 저택을 남겼을까?';
