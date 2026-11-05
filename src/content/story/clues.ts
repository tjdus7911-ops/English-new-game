import type { Clue } from '@/domain/story/types';

/** 단서 — 영어 문장·해석·학습 포인트 포함. 획득 여부는 저장 데이터(mansion.story.clues)에서 판단 */
export const CLUES: Clue[] = [
  {
    id: 'clue-inherit-letter', name: '상속 편지', desc: '하루에게 도착한 정체불명의 편지. 보낸 사람의 이름은 없다.', chapter: 'prologue', taskId: null,
    sentence: 'This house is yours now.', translation: '이 집은 이제 네 것이란다.',
    learning: ['yours = 너의 것 (소유대명사)', 'now = 이제, 지금'], eventId: 'prologue', assetKey: 'a/icon-scroll',
  },
  {
    id: 'clue-old-letter', name: '소파 밑 편지', desc: '바닥을 청소하다 강아지 호두가 냄새로 찾아낸 낡은 편지. 붉은 밀랍 봉인이 찍혀 있다.', chapter: 'ch1', taskId: 'L01',
    sentence: 'Look behind the picture.', translation: '그림 뒤를 살펴봐.',
    learning: ['look = 보다, 살펴보다', 'behind = ~의 뒤에 (전치사)', '동사로 시작하는 문장 = 명령·부탁 (명령문)'], eventId: 'ch1-letter', assetKey: 'a/icon-envelope',
  },
  {
    id: 'clue-small-key', name: '그림 뒤의 작은 열쇠', desc: '거실 그림 뒤에 숨겨져 있던 놋쇠 열쇠. 손잡이에 글귀가 새겨져 있다.', chapter: 'ch1', taskId: 'L01',
    sentence: 'For the one who comes home.', translation: '집으로 돌아오는 사람에게.',
    learning: ['for = ~을 위해, ~에게', 'the one who ~ = ~하는 사람', 'come home = 집에 오다'], eventId: 'ch1-key', assetKey: 'a/icon-key',
  },
  {
    id: 'clue-wall-pattern', name: '벽 속 덩굴 문양', desc: '낡은 벽지 밑에서 드러난 덩굴 그림. 잎사귀 사이에 단어가 숨어 있었다.', chapter: 'ch1', taskId: 'L04',
    sentence: 'Home is where the heart is.', translation: '집은 마음이 있는 곳이다.',
    learning: ['where = ~하는 곳 (관계부사)', 'heart = 마음, 심장', '영어 속담: 사랑하는 사람이 있는 곳이 집'], eventId: 'ch1-pattern', assetKey: 'a/icon-wall-scrap',
  },
  {
    id: 'clue-old-photo', name: '호숫가 사진', desc: '낡은 소파 세트의 안락의자 쿠션 사이에서 떨어진 사진. 어른 한 명과 아이 한 명이 웃고 있다.', chapter: 'ch1', taskId: 'L08',
    sentence: 'Summer at the lake, with little Haru.', translation: '호숫가의 여름, 어린 하루와 함께.',
    learning: ['at the lake = 호숫가에서', 'with = ~와 함께', 'little = 어린, 작은'], eventId: 'ch1-photo', assetKey: 'a/icon-photo',
  },
];
export const CLUE_BY_ID: Record<string, Clue> = Object.fromEntries(CLUES.map((c) => [c.id, c]));
