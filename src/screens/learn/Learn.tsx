/** 세로형 영어 학습 — 학습 선택(단어숲·도서관·시험장) → 스테이지 → 5문항 → 결과·최초 통과 별 */
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/store/app';
import { AREAS, STAGE_BY_ID, STAGES, stagesOf } from '@/content/mansion/stages';
import { stageStatus, starBalance } from '@/domain/mansion/logic';
import type { LearningArea } from '@/domain/mansion/types';
import type { StageResult } from '@/domain/mansion/logic';
import { Button, Card, Page, SectionTitle, Tag } from '@/components/ui';
import { QuizRunner, ResultView, toAnswers, type QResult } from '@/components/Quiz';
import { cx } from '@/lib/cx';
import { sfx } from '@/lib/sfx';

function StarsBar() {
  const bal = useApp((s) => starBalance(s.mansion));
  return <span className="inline-flex items-center gap-1 rounded-full bg-butter px-3 min-h-[36px] font-extrabold text-[#8a6100]" data-testid="learn-stars">⭐ {bal}</span>;
}

export function LearnHub() {
  const m = useApp((s) => s.mansion);
  const nav = useNavigate();
  return (
    <Page title="영어 학습" back="/mansion" right={<StarsBar />}>
      <Card className="bg-[linear-gradient(135deg,#FFF6E0,#FFE9C2)] border-[#F2D9B4]">
        <p className="font-extrabold text-[#4A3220]">스테이지를 처음 통과하면 저택 별 ⭐ 1개</p>
        <p className="text-sm text-[#7A5A3A] mt-1">5문제 중 4문제 이상 맞히면 통과예요. 모은 별로 저택을 고쳐요.</p>
      </Card>
      <div className="grid gap-3 mt-4">
        {AREAS.map((a) => {
          const list = stagesOf(a.id);
          const cleared = list.filter((s) => stageStatus(m, s) === 'cleared').length;
          const next = list.find((s) => stageStatus(m, s) !== 'cleared' && stageStatus(m, s) !== 'locked');
          return (
            <button key={a.id} type="button" onClick={() => nav(`/learn/area/${a.id}`)} data-testid={`area-${a.id}`}
              className="text-left rounded-card bg-white border border-line p-4 flex items-center gap-3 min-h-[84px] active:scale-[.99] transition">
              <span className="text-4xl" aria-hidden>{a.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-ink-soft">{a.place}</span>
                <span className="block font-extrabold text-lg">{a.title}</span>
                <span className="block text-sm text-ink-soft truncate">{next ? `다음: ${next.title}` : a.desc}</span>
              </span>
              <span className="text-right"><span className="block font-extrabold">{cleared}/{list.length}</span><span className="text-xs text-ink-soft">통과</span></span>
            </button>
          );
        })}
      </div>
      <SectionTitle>기록</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/learn/records" className="rounded-2xl bg-white border border-line p-3 min-h-[64px]" data-testid="go-records"><p className="font-bold">📊 학습 기록</p><p className="text-xs text-ink-soft">진도 · 정답률</p></Link>
        <Link to="/wrong-notes" className="rounded-2xl bg-white border border-line p-3 min-h-[64px]"><p className="font-bold">📝 오답노트</p><p className="text-xs text-ink-soft">틀린 문제 복습</p></Link>
        <Link to="/review" className="rounded-2xl bg-white border border-line p-3 min-h-[64px]"><p className="font-bold">🔁 오늘의 복습</p><p className="text-xs text-ink-soft">간격 반복</p></Link>
        <Link to="/home" className="rounded-2xl bg-white border border-line p-3 min-h-[64px]" data-testid="go-legacy"><p className="font-bold">🌳 학습 마을</p><p className="text-xs text-ink-soft">기존 강의·듣기·말하기</p></Link>
      </div>
      <Button size="lg" className="mt-5" onClick={() => nav('/mansion')} data-testid="back-mansion">저택으로 돌아가기</Button>
    </Page>
  );
}

export function AreaStages() {
  const { area } = useParams();
  const a = AREAS.find((x) => x.id === area);
  const m = useApp((s) => s.mansion);
  const nav = useNavigate();
  if (!a) return <Page title="학습" back="/learn"><p>없는 학습 영역이에요.</p></Page>;
  const list = stagesOf(a.id as LearningArea);
  return (
    <Page title={a.title} back="/learn" right={<StarsBar />}>
      <p className="text-sm text-ink-soft">{a.desc}</p>
      <div className="grid gap-2 mt-3">
        {list.map((s) => {
          const st = stageStatus(m, s);
          const p = m.stages[s.id];
          return (
            <button key={s.id} type="button" disabled={st === 'locked'} onClick={() => nav(`/learn/stage/${s.id}`)} data-testid={`stage-${s.id}`} data-status={st}
              className={cx('text-left rounded-2xl border p-3 flex items-center gap-3 min-h-[64px]', st === 'locked' ? 'bg-mist border-line opacity-60' : 'bg-white border-line')}>
              <span className={cx('grid place-items-center w-10 h-10 rounded-full font-black', st === 'cleared' ? 'bg-ok text-white' : st === 'locked' ? 'bg-line text-ink-faint' : 'bg-butter text-[#8a6100]')} aria-hidden>{st === 'cleared' ? '✓' : st === 'locked' ? '🔒' : s.order}</span>
              <span className="flex-1 min-w-0"><span className="block font-bold truncate">{s.title}</span><span className="block text-xs text-ink-soft truncate">{s.subtitle} · {s.cefr}</span></span>
              <span className="text-right text-xs">
                {st === 'cleared' ? <Tag tone="ok">최고 {p?.bestScore}/5</Tag> : st === 'in_progress' ? <Tag tone="warn">도전 중</Tag> : st === 'available' ? <Tag tone="accent">⭐ 첫 통과 +1</Tag> : <Tag>잠김</Tag>}
              </span>
            </button>
          );
        })}
      </div>
    </Page>
  );
}

const newAttempt = () => (globalThis.crypto?.randomUUID?.() ?? `att-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** READY → QUESTION/FEEDBACK(QuizRunner) → RESULT. 중도 종료 시(결과 미제출) 보상·기록 없음 */
export function StagePlay() {
  const { stageId } = useParams();
  const st = stageId ? STAGE_BY_ID[stageId] : undefined;
  const nav = useNavigate();
  const m = useApp((s) => s.mansion);
  const start = useApp((s) => s.startMansionStage);
  const complete = useApp((s) => s.completeMansionStage);
  const [phase, setPhase] = useState<'ready' | 'play' | 'result'>('ready');
  const [showPassage, setShowPassage] = useState(false);
  const [res, setRes] = useState<{ rs: QResult[]; r: StageResult } | null>(null);
  const attempt = useRef(newAttempt());
  const runKey = useRef(0);
  const nextStage = useMemo(() => (st ? STAGES.find((x) => x.prerequisites.includes(st.id)) : undefined), [st]);
  if (!st) return <Page title="스테이지" back="/learn"><p>없는 스테이지예요.</p></Page>;
  const status = stageStatus(m, st);
  const area = AREAS.find((a) => a.id === st.area)!;

  if (status === 'locked' && phase === 'ready') {
    return <Page title={st.title} back={`/learn/area/${st.area}`}><Card><p className="font-bold">🔒 잠긴 스테이지예요</p><p className="text-sm text-ink-soft mt-1">앞 스테이지를 먼저 통과해 주세요.</p></Card></Page>;
  }

  const passage = st.passage && (
    <Card className="bg-[#FFFBF2]" data-testid="passage">
      <p className="font-extrabold">{st.passage.title}</p>
      <div className="mt-2 grid gap-2">{st.passage.paragraphs.map((p, i) => <div key={i}><p className="leading-relaxed">{p.en}</p><p className="text-xs text-ink-soft">{p.ko}</p></div>)}</div>
    </Card>
  );

  return (
    <Page title={`${area.title} · ${st.title}`} back={`/learn/area/${st.area}`} right={<StarsBar />}>
      {phase === 'ready' && (
        <div data-testid="stage-ready">
          <Card>
            <p className="text-xs font-bold text-ink-soft">{area.place} · {st.cefr}</p>
            <p className="text-xl font-extrabold mt-1">{st.title}</p>
            <p className="text-sm text-ink-soft">{st.subtitle}</p>
            <ul className="mt-3 text-sm grid gap-1">
              <li>📝 5문항 · 4문항 이상 맞히면 통과</li>
              <li>{status === 'cleared' ? '✓ 이미 통과한 스테이지 — 다시 풀어도 별은 추가되지 않아요' : '⭐ 처음 통과하면 저택 별 1개'}</li>
              <li className="text-xs text-ink-faint">출처: {st.source}</li>
            </ul>
          </Card>
          {passage && <div className="mt-3">{passage}</div>}
          <Button size="lg" className="mt-4" data-testid="stage-start" onClick={() => { start(st.id); attempt.current = newAttempt(); runKey.current++; setPhase('play'); }}>시작하기</Button>
        </div>
      )}
      {phase === 'play' && (
        <div data-testid="stage-play">
          {passage && (
            <div className="mb-3">
              <button type="button" className="text-sm font-semibold underline min-h-[44px]" onClick={() => setShowPassage((v) => !v)}>{showPassage ? '본문 접기' : '본문 다시 보기'}</button>
              {showPassage && passage}
            </div>
          )}
          <QuizRunner key={runKey.current} questions={st.questions} title={st.title} onDone={(rs) => {
            const r = complete(st.id, attempt.current, toAnswers(rs, 'lesson'));
            if (!r) return;
            if (r.starsGranted) sfx('star');
            setRes({ rs, r });
            setPhase('result');
          }} />
        </div>
      )}
      {phase === 'result' && res && (
        <div data-testid="stage-result" data-passed={res.r.passed ? '1' : '0'}>
          {res.r.starsGranted > 0 && (
            <div className="rounded-card p-4 mb-3 text-center bg-[linear-gradient(135deg,#FFF1C2,#FFD978)] border-2 border-[#F2C55C] pop-in" data-testid="star-reward">
              <p className="text-4xl">⭐</p><p className="font-extrabold text-lg text-[#6B4300]">첫 통과! 저택 별 +{res.r.starsGranted}</p><p className="text-sm text-[#8a6100]">저택으로 돌아가 리모델링 미션에 써 보세요.</p>
            </div>
          )}
          {res.r.passed && !res.r.firstClear && <p className="mb-3 text-sm text-center text-ink-soft" data-testid="no-reward">이미 통과한 스테이지라 별은 추가되지 않았어요. 기록만 갱신했어요.</p>}
          <ResultView results={res.rs} title={st.title} passLabel={res.r.passed ? '통과' : `${st.passingScore}개 이상 맞히면 통과`}>
            <Button size="lg" onClick={() => nav('/mansion')} data-testid="result-mansion">저택으로 돌아가기</Button>
            {!res.r.passed && <Button variant="secondary" onClick={() => { setRes(null); attempt.current = newAttempt(); runKey.current++; setPhase('play'); }} data-testid="result-retry">다시 도전</Button>}
            {res.r.passed && nextStage && <Button variant="secondary" onClick={() => { setRes(null); setPhase('ready'); nav(`/learn/stage/${nextStage.id}`); }} data-testid="result-next">다음 스테이지</Button>}
            <Button variant="ghost" onClick={() => nav(`/learn/area/${st.area}`)}>스테이지 목록</Button>
          </ResultView>
        </div>
      )}
    </Page>
  );
}

export function LearnRecords() {
  const m = useApp((s) => s.mansion);
  const l = useApp((s) => s.learning);
  const logs = l.log.filter((e) => e.kind === 'mansion-stage');
  const correct = logs.reduce((a, e) => a + e.correct, 0), total = logs.reduce((a, e) => a + e.total, 0);
  const wrong = Object.values(l.wrongNotes).filter((w) => !w.resolved).length;
  return (
    <Page title="학습 기록" back="/learn">
      <div className="grid grid-cols-3 gap-2" data-testid="records-summary">
        <Card className="!p-3 text-center"><p className="text-xs text-ink-soft">통과 스테이지</p><p className="text-xl font-extrabold">{Object.values(m.stages).filter((s) => s.status === 'cleared').length}</p></Card>
        <Card className="!p-3 text-center"><p className="text-xs text-ink-soft">정답률</p><p className="text-xl font-extrabold">{total ? Math.round((correct / total) * 100) : 0}%</p></Card>
        <Card className="!p-3 text-center"><p className="text-xs text-ink-soft">복습할 오답</p><p className="text-xl font-extrabold">{wrong}</p></Card>
      </div>
      <SectionTitle>영역별 진도</SectionTitle>
      <div className="grid gap-2">
        {AREAS.map((a) => {
          const list = stagesOf(a.id);
          const c = list.filter((s) => m.stages[s.id]?.status === 'cleared').length;
          return (
            <Card key={a.id} className="!p-3">
              <div className="flex justify-between text-sm font-bold"><span>{a.icon} {a.title}</span><span>{c}/{list.length}</span></div>
              <div className="h-2 mt-2 rounded-full bg-mist overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: `${(c / list.length) * 100}%` }} /></div>
            </Card>
          );
        })}
      </div>
      <SectionTitle>최근 스테이지</SectionTitle>
      {logs.length === 0 ? <p className="text-sm text-ink-soft">아직 기록이 없어요.</p> : (
        <div className="grid gap-1.5">{logs.slice(-10).reverse().map((e) => <div key={e.id} className="rounded-xl bg-white border border-line px-3 py-2 flex justify-between text-sm"><span>{e.title}</span><span className={e.completed ? 'text-ok font-bold' : 'text-ink-soft'}>{e.correct}/{e.total}{e.completed ? ' 통과' : ''}</span></div>)}</div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Link to="/wrong-notes"><Button variant="secondary" className="w-full">오답노트</Button></Link>
        <Link to="/review"><Button variant="secondary" className="w-full">복습하기</Button></Link>
      </div>
    </Page>
  );
}
