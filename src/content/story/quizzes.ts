import type { StoryQuiz } from '@/domain/story/types';

/** 스토리 영어 추리 퀴즈 — 별을 쓰지 않고, 반복 오답 시 전체 해석을 보여 줘서 스토리가 막히지 않게 한다. A1 → A2 순으로 상승 */
export const STORY_QUIZZES: StoryQuiz[] = [
  {
    id: 'q-prologue-letter', type: 'choice', cefr: 'A1', source: 'Dear Haru,\nThis house is yours now.\nPlease take good care of it.', sourceLabel: '상속 편지',
    prompt: '편지의 두 번째 줄 "This house is yours now."의 뜻은?',
    choices: ['이 집은 이제 네 것이다.', '이 집은 곧 팔릴 것이다.', '지금 이 집으로 와라.'], answer: '이 집은 이제 네 것이다.',
    glosses: [{ en: 'house', ko: '집' }, { en: 'yours', ko: '너의 것' }, { en: 'now', ko: '이제, 지금' }],
    translation: '하루에게. 이 집은 이제 네 것이란다. 잘 돌봐 주렴.', explanation: 'yours 는 "너의 것"이라는 뜻의 소유대명사예요.',
  },
  {
    id: 'q-ch1-behind', type: 'choice', cefr: 'A1', source: 'Look behind the picture.', sourceLabel: '소파 밑 편지',
    prompt: '편지의 의미로 올바른 것은 무엇일까요?',
    choices: ['그림을 자세히 그려라.', '그림 뒤를 살펴봐라.', '그림을 밖으로 가져가라.'], answer: '그림 뒤를 살펴봐라.',
    glosses: [{ en: 'Look', ko: '보다' }, { en: 'behind', ko: '뒤에' }, { en: 'picture', ko: '그림' }],
    translation: '그림 뒤를 살펴봐.', explanation: 'behind 는 "~의 뒤에"라는 뜻의 전치사예요. 동사 Look 으로 시작하니 "~해라"라는 명령문이에요.',
  },
  {
    id: 'q-ch1-pattern', type: 'order', cefr: 'A2', source: 'is · Home · heart · where · the · is', sourceLabel: '벽 속 덩굴 문양',
    prompt: '문양 속 단어를 순서대로 눌러 문장을 완성하세요.',
    tokens: ['is', 'Home', 'heart', 'where', 'the', 'is'], answer: 'Home is where the heart is',
    glosses: [{ en: 'Home', ko: '집' }, { en: 'where', ko: '~하는 곳' }, { en: 'heart', ko: '마음' }],
    translation: '집은 마음이 있는 곳이다.', explanation: '"A is where B is" = "A는 B가 있는 곳이다". 주어 Home 으로 시작해요.',
  },
  {
    id: 'q-ch1-photo', type: 'choice', cefr: 'A2', source: 'Summer at the lake,\nwith little Haru.', sourceLabel: '호숫가 사진 뒷면',
    prompt: '사진 속 아이는 누구일까요?',
    choices: ['어린 시절의 하루', '관리인 오브리', '강아지 호두'], answer: '어린 시절의 하루',
    glosses: [{ en: 'summer', ko: '여름' }, { en: 'lake', ko: '호수' }, { en: 'with', ko: '~와 함께' }, { en: 'little', ko: '어린' }],
    translation: '호숫가의 여름, 어린 하루와 함께.', explanation: 'with little Haru = "어린 하루와 함께". 사진 속 아이가 바로 하루예요.',
  },
];
export const QUIZ_BY_ID: Record<string, StoryQuiz> = Object.fromEntries(STORY_QUIZZES.map((q) => [q.id, q]));
