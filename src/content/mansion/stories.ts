/**
 * 도서관 · 동화 (자체 제작, CEFR A1). 저작권: 프로젝트 자체 창작 — 외부 텍스트 인용 없음.
 * 기존 독해(rd-01~03)는 5문항 스테이지에 맞추기 위해 자체 제작 보충 문항을 덧붙인다.
 */
import type { Question } from '@/domain/types';

const q = (id: string, conceptId: string, prompt: string, choices: string[], answer: string, explanation: string): Question =>
  ({ id, type: 'mc', prompt, choices, answers: [answer], explanation, conceptId });

export interface Story { id: string; title: string; conceptId: string; paragraphs: { en: string; ko: string }[]; questions: Question[] }

export const STORIES: Story[] = [
  {
    id: 'st-01', title: 'The Little Star and the Lamp', conceptId: 'a1-u02',
    paragraphs: [
      { en: 'Pip is a little star. He is very small, and his light is weak.', ko: '핍은 작은 별이에요. 아주 작고, 빛도 약해요.' },
      { en: 'One night, Pip falls into an old house. The house is dark and quiet.', ko: '어느 밤, 핍은 오래된 집으로 떨어져요. 집은 어둡고 조용해요.' },
      { en: 'A girl finds Pip under the sofa. "You are cold," she says. She puts Pip in a lamp.', ko: '한 소녀가 소파 밑에서 핍을 찾아요. "너 춥구나." 소녀는 핍을 램프 안에 넣어요.' },
      { en: 'The lamp is warm. Pip shines and shines. Now the room is bright!', ko: '램프는 따뜻해요. 핍은 반짝반짝 빛나요. 이제 방이 환해요!' },
    ],
    questions: [
      q('st-01-q1', 'a1-u02', '핍은 누구인가요?', ['작은 별', '작은 고양이', '작은 램프'], '작은 별', '"Pip is a little star."'),
      q('st-01-q2', 'a1-u02', '핍이 떨어진 집은 어떤가요?', ['밝고 시끄럽다', '어둡고 조용하다', '크고 새것이다'], '어둡고 조용하다', '"The house is dark and quiet."'),
      q('st-01-q3', 'a1-u08', '소녀는 핍을 어디에서 찾았나요?', ['소파 밑', '책상 위', '창문 옆'], '소파 밑', '"under the sofa" = 소파 밑'),
      q('st-01-q4', 'a1-u02', '빈칸에 알맞은 말: "You ___ cold."', ['is', 'am', 'are'], 'are', 'you 와 함께 쓰는 be동사는 are 예요.'),
      q('st-01-q5', 'a1-u02', '이야기의 마지막에 방은 어떻게 되나요?', ['밝아진다', '추워진다', '조용해진다'], '밝아진다', '"Now the room is bright!"'),
    ],
  },
  {
    id: 'st-02', title: 'The Teapot Who Could Sing', conceptId: 'a1-u09',
    paragraphs: [
      { en: 'There is a blue teapot in the kitchen. Her name is Tilly.', ko: '부엌에 파란 찻주전자가 있어요. 이름은 틸리예요.' },
      { en: 'Tilly can sing, but she can\'t dance. Every morning, she sings a happy song.', ko: '틸리는 노래할 수 있지만 춤은 못 춰요. 매일 아침 행복한 노래를 불러요.' },
      { en: 'The cups and spoons love her song. "Can you sing for us again?" they ask.', ko: '컵과 숟가락들은 틸리의 노래를 좋아해요. "우리를 위해 다시 불러 줄 수 있어?" 하고 물어요.' },
      { en: '"Of course I can!" says Tilly. The whole kitchen sings together.', ko: '"물론이지!" 틸리가 말해요. 부엌 전체가 함께 노래해요.' },
    ],
    questions: [
      q('st-02-q1', 'a1-u09', '틸리는 무엇인가요?', ['파란 찻주전자', '빨간 컵', '은 숟가락'], '파란 찻주전자', '"a blue teapot ... Her name is Tilly."'),
      q('st-02-q2', 'a1-u09', '틸리가 할 수 없는 것은?', ['노래하기', '춤추기', '말하기'], '춤추기', '"she can\'t dance" = 춤을 못 춰요.'),
      q('st-02-q3', 'a1-u04', '틸리는 언제 노래하나요?', ['매일 아침', '매일 밤', '주말에만'], '매일 아침', '"Every morning, she sings"'),
      q('st-02-q4', 'a1-u09', '"Can you sing for us again?"의 뜻으로 알맞은 것은?', ['우리를 위해 다시 노래해 줄 수 있어?', '우리는 다시 노래할 수 있어.', '너는 노래를 못 해.'], '우리를 위해 다시 노래해 줄 수 있어?', 'Can you ~? = ~해 줄 수 있어?'),
      q('st-02-q5', 'a1-u09', '빈칸에 알맞은 말: "Of course I ___!"', ['can', 'can\'t', 'is'], 'can', '질문 Can you ~? 에 긍정으로 답하면 I can.'),
    ],
  },
  {
    id: 'st-03', title: 'The Moon Bakery', conceptId: 'a1-u03',
    paragraphs: [
      { en: 'Mr. Bun has a small bakery on the hill. He bakes bread at night.', ko: '번 씨는 언덕 위에 작은 빵집이 있어요. 그는 밤에 빵을 구워요.' },
      { en: 'The moon watches him. She wants a piece of bread, too.', ko: '달이 그를 지켜봐요. 달도 빵 한 조각을 먹고 싶어요.' },
      { en: 'Mr. Bun makes a round, yellow bread for the moon. It looks like the moon!', ko: '번 씨는 달을 위해 동그랗고 노란 빵을 만들어요. 꼭 달처럼 생겼어요!' },
      { en: 'The moon smiles. Every night, she gives the bakery soft, silver light.', ko: '달이 미소 지어요. 매일 밤 달은 빵집에 부드러운 은빛을 비춰 줘요.' },
    ],
    questions: [
      q('st-03-q1', 'a1-u03', '번 씨의 빵집은 어디에 있나요?', ['언덕 위', '강 옆', '시장 안'], '언덕 위', '"on the hill"'),
      q('st-03-q2', 'a1-u03', '번 씨는 언제 빵을 굽나요?', ['아침에', '밤에', '점심에'], '밤에', '"He bakes bread at night."'),
      q('st-03-q3', 'a1-u03', '빈칸에 알맞은 말: "The moon ___ a piece of bread."', ['want', 'wants', 'wanting'], 'wants', '주어가 3인칭 단수(The moon)라서 wants.'),
      q('st-03-q4', 'a1-u03', '달을 위한 빵은 어떤 모양인가요?', ['동그랗고 노랗다', '네모나고 하얗다', '길고 갈색이다'], '동그랗고 노랗다', '"a round, yellow bread"'),
      q('st-03-q5', 'a1-u03', '달은 빵집에 무엇을 주나요?', ['은빛', '빵', '별'], '은빛', '"soft, silver light"'),
    ],
  },
];

/** 기존 독해에 덧붙이는 보충 문항 (자체 제작) */
export const READING_EXTRA: Record<string, Question[]> = {
  'rd-01': [q('rd-01-mq5', 'a1-u04', '미나는 몇 시에 일어나나요?', ['5시', '6시', '7시'], '6시', '"She gets up at six every morning."')],
  'rd-02': [
    q('rd-02-mq4', 'a1-u09', '레오의 할머니는 어디에 계신가요?', ['서울', '부산', '역 근처'], '부산', '"I visit her in Busan"'),
    q('rd-02-mq5', 'a1-u09', '레오가 소라에게 사 주겠다고 한 것은?', ['케이크', '꽃', '책'], '케이크', '"I can buy you a cake!"'),
  ],
  'rd-03': [
    q('rd-03-mq4', 'a1-u08', '책들은 어디에 있나요?', ['책상 위', '침대 밑', '가방 안'], '책상 위', '"My books are on the desk"'),
    q('rd-03-mq5', 'a1-u08', '글쓴이는 언제 방에서 공부하나요?', ['매일 아침', '매일 저녁', '주말마다'], '매일 저녁', '"I study in my room every evening."'),
  ],
};

export const STORY_QUESTIONS: Question[] = [...STORIES.flatMap((s) => s.questions), ...Object.values(READING_EXTRA).flat()];
