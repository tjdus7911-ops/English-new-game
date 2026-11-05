/**
 * 저택 학습 스테이지 — 기존 콘텐츠(단어 300 · 문법 10단원 · 독해 · 단원평가)를 5문항 스테이지로 재구성.
 * 문항 id 는 기존 문항 id 를 그대로 써서 오답노트·복습(SRS)과 연결된다.
 */
import type { Question } from '@/domain/types';
import type { LearningArea, StageDef } from '@/domain/mansion/types';
import { GRAMMAR_UNITS } from '@/content/grammar';
import { vocabForUnit } from '@/content/vocab';
import { READINGS } from '@/content/reading-leveltest';
import { wordMeaningQ, wordReverseQ } from '@/lib/questions';
import { READING_EXTRA, STORIES } from './stories';

const PASS = 4;
const CHOICE = new Set(['mc', 'translate', 'order']);

function chain(defs: Omit<StageDef, 'prerequisites' | 'passingScore' | 'rewardStars' | 'order'>[]): StageDef[] {
  return defs.map((d, i) => ({ ...d, order: i + 1, passingScore: PASS, rewardStars: 1, prerequisites: i ? [defs[i - 1].id] : [] }));
}

const vocabStages = chain(GRAMMAR_UNITS.map((u) => {
  const words = vocabForUnit(u.id);
  const picks = [0, 6, 12, 18, 24].map((k) => words[k % words.length]);
  return {
    id: `voc-${u.id}`, area: 'vocabulary' as const, title: `단어숲 ${u.order}`, subtitle: `${u.title} 단원 단어 5개`, cefr: u.level,
    questions: picks.map((w, i) => (i % 2 ? wordReverseQ(w) : wordMeaningQ(w))), source: '자체 제작 단어장 (A1 300단어)',
  };
}));

const grammarStages = chain(GRAMMAR_UNITS.map((u) => ({
  id: `gra-${u.id}`, area: 'grammar' as const, title: `문법 ${u.order}. ${u.title}`, subtitle: u.titleEn, cefr: u.level,
  questions: u.practice.filter((q) => q.type === 'mc').slice(0, 5), source: '자체 제작 문법 강의 확인 문제',
})));

type ReadingSrc = { id: string; title: string; paragraphs: { en: string; ko: string }[]; questions: Question[]; story: boolean };
const R = Object.fromEntries(READINGS.map((r) => [r.id, r]));
const readingOrder: ReadingSrc[] = [
  { ...STORIES[0], story: true },
  { id: 'rd-01', title: R['rd-01'].title, paragraphs: R['rd-01'].paragraphs, questions: [...R['rd-01'].questions, ...READING_EXTRA['rd-01']], story: false },
  { ...STORIES[1], story: true },
  { id: 'rd-03', title: R['rd-03'].title, paragraphs: R['rd-03'].paragraphs, questions: [...R['rd-03'].questions, ...READING_EXTRA['rd-03']], story: false },
  { ...STORIES[2], story: true },
  { id: 'rd-02', title: R['rd-02'].title, paragraphs: R['rd-02'].paragraphs, questions: [...R['rd-02'].questions, ...READING_EXTRA['rd-02']], story: false },
];
const readingStages = chain(readingOrder.map((r) => ({
  id: `rea-${r.id}`, area: 'reading' as const, title: r.title, subtitle: r.story ? '동화 · 자체 창작' : '생활 독해 · 자체 제작', cefr: 'A1' as const,
  questions: r.questions.slice(0, 5), passage: { title: r.title, paragraphs: r.paragraphs.map((p) => ({ en: p.en, ko: p.ko })) },
  source: r.story ? '자체 창작 동화 (프로젝트 저작물)' : '자체 제작 독해 + 보충 문항',
})));

const examStages = chain(GRAMMAR_UNITS.map((u) => ({
  id: `exa-${u.id}`, area: 'exam' as const, title: `모의평가 ${u.order}`, subtitle: `${u.title} 단원 평가`, cefr: u.level,
  questions: u.unitTest.filter((q) => CHOICE.has(q.type)).slice(0, 5), source: '자체 제작 연습 문제 · 공식 시험과 무관(비제휴)',
})));

export const STAGES: StageDef[] = [...vocabStages, ...grammarStages, ...readingStages, ...examStages];
export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const stagesOf = (area: LearningArea) => STAGES.filter((s) => s.area === area);

export const AREAS: { id: LearningArea; place: string; title: string; desc: string; icon: string }[] = [
  { id: 'vocabulary', place: '단어숲', title: '단어숲', desc: '단원별 핵심 단어 5문항', icon: '🌳' },
  { id: 'grammar', place: '도서관', title: '도서관 · 문법', desc: 'A1 문법 10단원 확인 문제', icon: '📘' },
  { id: 'reading', place: '도서관', title: '도서관 · 동화', desc: '자체 창작 동화와 생활 독해', icon: '📖' },
  { id: 'exam', place: '시험장', title: '시험장', desc: '단원 모의평가 (공식 시험과 무관)', icon: '🏛' },
];
