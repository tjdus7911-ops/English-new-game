/**
 * 저택 리모델링 핵심 루프 E2E
 * 시안 A v3 장면: 영어 문제 풀이 → 별 → 쓰레기 치우기(이전 상태 레이어 제거) → 편지 → 영어 해석 → 그림 → 열쇠
 * → 벽 칠하기(3종 미리보기·취소·확정) → 저장·새로고침 유지 · 무료 스타일 변경 · 중복 소비 방지 · 주방 해금 · 화면 방향
 */
import { expect, test, type Page } from '@playwright/test';
import { seed, open, readSaved, LANDSCAPE, PORTRAIT } from './mansion-helpers';
import { runQuiz } from './helpers';
import { QUIZ_BY_ID } from '../src/content/story/quizzes';

const STORY_DONE_TO_KEY = ['prologue', 'ch1-clean', 'ch1-letter', 'ch1-key'];
const stars = (n: number) => [{ id: 'seed', idempotencyKey: 'earn:seed', type: 'earn' as const, amount: n, sourceId: 'seed', createdAt: '2026-11-04' }];

/** 스토리 퀴즈를 정답 데이터로 푼다 (wrongFirst 회 일부러 틀림) */
async function solveQuiz(page: Page, wrongFirst = 0) {
  const id = (await page.getByTestId('quiz-id').getAttribute('data-id'))!;
  const q = QUIZ_BY_ID[id];
  for (let i = 0; i < wrongFirst; i++) {
    if (q.type === 'choice') await page.getByTestId(`quiz-choice-${q.choices!.findIndex((c) => c !== q.answer)}`).click();
  }
  if (q.type === 'choice') await page.getByTestId(`quiz-choice-${q.choices!.indexOf(q.answer)}`).click();
  else {
    const used = new Set<string>();
    for (const w of q.answer.split(' ')) {
      const btns = page.locator(`[data-testid^="quiz-token-${w}-"]`);
      const n = await btns.count();
      for (let k = 0; k < n; k++) { const tid = (await btns.nth(k).getAttribute('data-testid'))!; if (!used.has(tid) && await btns.nth(k).isEnabled()) { used.add(tid); await btns.nth(k).click(); break; } }
    }
  }
  await expect(page.getByTestId('quiz-solved')).toBeVisible();
  await page.getByTestId('quiz-continue').click();
}

/** 진행 중인 연출·스토리를 끝까지 (대화는 건너뛰기, 퀴즈는 풀고, 단서 카드는 닫음) */
async function finishScene(page: Page, quizWrong = 0) {
  for (let i = 0; i < 80; i++) {
    if (await page.getByTestId('story-quiz').isVisible().catch(() => false)) { await solveQuiz(page, quizWrong); continue; }
    if (await page.getByTestId('clue-card').isVisible().catch(() => false)) { await page.getByTestId('clue-close').click(); continue; }
    if (await page.getByTestId('skip').isVisible().catch(() => false)) { await page.getByTestId('skip').click().catch(() => {}); await page.waitForTimeout(150); continue; }
    if ((await page.getByTestId('mansion-screen').getAttribute('data-busy')) === '0') return;
    await page.waitForTimeout(200);
  }
  throw new Error('scene did not finish');
}

test.describe('저택 리모델링 (가로형)', () => {
  test.use({ viewport: LANDSCAPE });

  test('신규 유저: 학습 → 별 → 청소 애니메이션 → 편지 해석 → 그림 뒤 열쇠 (전체 흐름)', async ({ page }) => {
    await seed(page);
    await open(page, '/mansion/living');
    // 프롤로그 (상속 편지 영어 해석 포함)
    await expect(page.getByTestId('dialog')).toBeVisible();
    await finishScene(page);
    await expect(page.getByTestId('mansion-stars')).toContainText('0');
    // 별 부족 → 학습 안내
    await page.getByTestId('next-mission').click();
    await expect(page.getByTestId('need-stars')).toBeVisible();
    await page.getByTestId('go-learn').click();
    // 학습은 세로형: 기기 회전
    await expect(page).toHaveURL(/#\/learn$/);
    await expect(page.getByTestId('rotate-overlay')).toBeVisible();
    await page.setViewportSize(PORTRAIT);
    await expect(page.getByTestId('rotate-overlay')).toHaveCount(0);
    await page.getByTestId('area-vocabulary').click();
    await page.getByTestId('stage-voc-a1-u01').click();
    await page.getByTestId('stage-start').click();
    await runQuiz(page, (i) => i !== 4); // 5문제 중 4개 정답 → 통과
    await expect(page.getByTestId('star-reward')).toContainText('+1');
    await page.getByTestId('result-mansion').click();
    await page.setViewportSize(LANDSCAPE);
    // 홈 = 전체 저택 맵 → 거실 선택 (확대 연출 후 거실 화면)
    await expect(page.getByTestId('map-screen')).toBeVisible();
    await expect(page.getByTestId('map-stars')).toContainText('1');
    await page.getByTestId('map-room-living').click();
    await expect(page).toHaveURL(/#\/mansion\/living$/);
    await expect(page.getByTestId('mansion-stars')).toContainText('1');
    // 쓰레기 치우기: 별 1개 차감 → 이전 상태 레이어(상자·낙엽·카펫)가 사라짐
    await expect(page.getByTestId('pre-A1')).toHaveCount(1);
    await page.getByTestId('hotspot-A1').click();
    await page.getByTestId('task-confirm-go').click();
    let saved = await readSaved(page);
    expect(saved!.state.mansion.renovations.A1.status).toBe('completed'); // 연출 중에도 이미 저장됨
    await expect(page.getByTestId('mansion-world')).toHaveAttribute('data-cleaned', '1', { timeout: 15000 });
    await expect(page.getByTestId('pre-A1')).toHaveCount(0);
    // 소파 밑 편지 (스토리 자동 실행) → 대화 건너뛰기
    await finishScene(page);
    await expect(page.getByTestId('interact-letter')).toBeVisible();
    // 편지 해석: 두 번 틀리면 단어 힌트 → 전체 해석 → 정답
    await page.getByTestId('interact-letter').click();
    await expect(page.getByTestId('story-quiz')).toBeVisible();
    await page.getByTestId('quiz-choice-0').click();
    await expect(page.getByTestId('quiz-gloss')).toContainText('behind');
    await page.getByTestId('quiz-choice-2').click();
    await expect(page.getByTestId('quiz-translation')).toContainText('그림 뒤를 살펴봐');
    await page.getByTestId('quiz-choice-1').click();
    await page.getByTestId('quiz-continue').click();
    await expect(page.getByTestId('clue-name')).toHaveText('소파 밑 편지');
    await finishScene(page);
    // 그림 → 열쇠
    await page.getByTestId('interact-painting').click();
    await finishScene(page);
    saved = await readSaved(page);
    const m = saved!.state.mansion;
    expect(Object.keys(m.story.clues).sort()).toEqual(['clue-inherit-letter', 'clue-old-letter', 'clue-small-key']);
    expect(m.story.quizzes['q-ch1-behind']).toMatchObject({ solved: true, attempts: 3 });
    expect(m.story.completedEvents).toEqual(['prologue', 'ch1-clean', 'ch1-letter', 'ch1-key']);
    expect(m.ledger.filter((e) => e.type === 'spend')).toHaveLength(1);
    // 다음 미션(벽지) 열림 · 단서 수집함
    await page.getByTestId('open-board').click();
    await expect(page.getByTestId('mission-A2')).toHaveAttribute('data-status', 'available');
    await expect(page.getByTestId('mission-A1')).toHaveAttribute('data-status', 'completed');
    await page.keyboard.press('Escape');
    await page.getByTestId('open-clues').click();
    await expect(page.getByTestId('clue-slot-clue-small-key')).toHaveAttribute('data-found', '1');
    await expect(page.getByTestId('clue-slot-clue-old-photo')).toHaveAttribute('data-found', '0');
  });

  test('벽지 교체 → 벽 속 문양 퍼즐 → 단서 획득', async ({ page }) => {
    await seed(page, (s) => {
      s.mansion.ledger = stars(3);
      s.mansion.renovations = Object.fromEntries(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map((id) => [id, { taskId: id, status: 'completed', completedAt: '2026-11-04' }]));
      s.mansion.story.completedEvents = [...STORY_DONE_TO_KEY];
    });
    await open(page, '/mansion/living');
    await expect(page.getByTestId('pre-B8')).toHaveCount(1);
    await page.getByTestId('hotspot-B8').click();
    await page.getByTestId('variant-next').click(); // ‹ › 로 디자인 넘기기 (처음엔 선택 없음 → 첫 디자인)
    await expect(page.getByTestId('variant-wp-flower')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('variant-prev').click();
    await expect(page.getByTestId('variant-wp-damask')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('variant-confirm').click();
    await finishScene(page);
    await expect(page.getByTestId('pre-B8')).toHaveCount(0);
    await expect(page.getByTestId('mansion-stars')).toContainText('1');
    const saved1 = await readSaved(page);
    expect(saved1!.state.mansion.story.completedEvents).toContain('ch1-pattern');
    expect(Object.keys(saved1!.state.mansion.story.clues)).toContain('clue-wall-pattern');
  });

  test('가구 교체: 소파 3종 미리보기(별 차감 없음) → 확정 시 별 3개 차감 · 저장 · 맵과 같은 데이터', async ({ page }) => {
    await seed(page, (s) => {
      s.mansion.ledger = stars(4);
      s.mansion.renovations = Object.fromEntries([...['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'], 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14'].map((id) => [id, { taskId: id, status: 'completed', completedAt: '2026-11-04', ...(id === 'B8' ? { selectedVariantId: 'wp-flower' } : id === 'B9' ? { selectedVariantId: 'fl-warm' } : {}) }]));
      s.mansion.story.completedEvents = [...STORY_DONE_TO_KEY, 'ch1-pattern'];
    });
    await open(page, '/mansion/living');
    const world = page.getByTestId('mansion-world');
    await expect(world).toHaveAttribute('data-sofa', 'old');
    await page.getByTestId('hotspot-C15').click();
    await page.getByTestId('variant-sofa-green').click();
    await expect(page.getByTestId('variant-layer-C15')).toHaveAttribute('data-asset', 'scene/var-C15-sage');
    await expect(page.getByTestId('mansion-stars')).toContainText('4'); // 미리보기는 무료
    await page.getByTestId('variant-confirm').click();
    await finishScene(page);
    await expect(world).toHaveAttribute('data-sofa', 'sofa-green');
    await expect(page.getByTestId('mansion-stars')).toContainText('1');
    const saved = await readSaved(page);
    expect(saved!.state.mansion.renovations.C15).toMatchObject({ status: 'completed', selectedVariantId: 'sofa-green' });
    await open(page, '/mansion/living');
    await expect(page.getByTestId('variant-layer-C15')).toHaveAttribute('data-asset', 'scene/var-C15-sage');
    await expect(page.getByTestId('panel-C16')).toHaveAttribute('data-status', 'available');
    // 전체 맵에도 같은 소파 디자인
    await page.getByTestId('back-map').click();
    await expect(page.getByTestId('map-variant-C15')).toHaveAttribute('data-variant', 'sofa-green');
  });

  test('작은 가로 화면: 그림이 상단 카드에 가려져도 패널 버튼으로 단서 조사 → 열쇠 → 벽지 교체 열림', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await seed(page, (s) => {
      s.mansion.ledger = stars(2);
      s.mansion.renovations = Object.fromEntries(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map((id) => [id, { taskId: id, status: 'completed', completedAt: '2026-11-04' }]));
      s.mansion.story.completedEvents = ['prologue', 'ch1-clean', 'ch1-letter'];
    });
    await open(page, '/mansion/living');
    await expect(page.getByTestId('next-mission')).toContainText('벽에 걸린 그림 살펴보기');
    await page.getByTestId('next-mission').click();
    await finishScene(page);
    const saved = await readSaved(page);
    expect(saved!.state.mansion.story.completedEvents).toContain('ch1-key');
    await expect(page.getByTestId('next-mission')).toContainText('미션 시작');
  });

  test('벽 색 3종 미리보기·취소·확정, 새로고침 유지, 꾸미기에서 무료 변경', async ({ page }) => {
    await seed(page, (s) => {
      s.mansion.ledger = stars(2);
      s.mansion.renovations = Object.fromEntries(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map((id) => [id, { taskId: id, status: 'completed', completedAt: '2026-11-04' }]));
      s.mansion.story.completedEvents = [...STORY_DONE_TO_KEY, 'ch1-pattern'];
    });
    await open(page, '/mansion/living');
    const world = page.getByTestId('mansion-world');
    await expect(world).toHaveAttribute('data-wall', 'old');
    await page.getByTestId('hotspot-B8').click();
    await page.getByTestId('variant-wp-mint').click();
    await expect(page.getByTestId('variant-layer-B8')).toHaveAttribute('data-asset', 'scene/var-B8-sage');
    await page.getByTestId('variant-wp-flower').click();
    await expect(page.getByTestId('variant-layer-B8')).toHaveCount(0); // 원본
    await page.getByTestId('variant-cancel').click();
    await expect(page.getByTestId('variant-layer-B8')).toHaveCount(0);
    await expect(page.getByTestId('pre-B8')).toHaveCount(1);
    await expect(page.getByTestId('mansion-stars')).toContainText('2');
    // 확정
    await page.getByTestId('hotspot-B8').click();
    await page.getByTestId('variant-wp-damask').click();
    await page.getByTestId('variant-confirm').click();
    await finishScene(page);
    await expect(world).toHaveAttribute('data-wall', 'wp-damask');
    await expect(page.getByTestId('pre-B8')).toHaveCount(0);
    await expect(page.getByTestId('mansion-stars')).toContainText('0');
    // 새로고침 후 유지
    await open(page, '/mansion/living');
    await expect(world).toHaveAttribute('data-wall', 'wp-damask');
    await expect(page.getByTestId('variant-layer-B8')).toHaveAttribute('data-asset', 'scene/var-B8-rose');
    // 꾸미기 모드: 무료 스타일 변경
    await page.getByTestId('toggle-edit').click();
    await page.getByTestId('edit-B8').click();
    await page.getByTestId('variant-wp-mint').click();
    await page.getByTestId('variant-confirm').click();
    await expect(world).toHaveAttribute('data-wall', 'wp-mint');
    await expect(page.getByTestId('mansion-stars')).toContainText('0');
    const after = await readSaved(page);
    expect(after!.state.mansion.renovations.B8.selectedVariantId).toBe('wp-mint');
    expect(after!.state.mansion.ledger.filter((e) => e.type === 'spend')).toHaveLength(1);
  });

  test('거실 전체 완료 → 주방 해금 표시 (v3 완성 화면)', async ({ page }) => {
    await seed(page, (s) => {
      s.mansion.renovations = Object.fromEntries(['A1','A2','A3','A4','A5','A6','A7','B8','B9','B10','B11','B12','B13','B14','C15','C16','C17','C18','C19','C20','C21','C22','D23','D24','D25','D26','D27','D28','E29','E30','E31','E32','E33','E34','E35','E36','E37','E38','E39','E40'].map((id) => [id, { taskId: id, status: 'completed', completedAt: '2026-11-04' }]));
      s.mansion.story.completedEvents = [...STORY_DONE_TO_KEY, 'ch1-pattern', 'ch1-photo', 'ch1-finale'];
    });
    await open(page, '/mansion/living');
    await expect(page.getByTestId('mansion-world')).toHaveAttribute('data-done', '40');
    await expect(page.locator('[data-testid^="pre-"]')).toHaveCount(0); // 이전 상태 레이어 없음 = 확정 v3
    await expect(page.getByTestId('room-kitchen')).toHaveAttribute('data-unlocked', '1');
  });

  test('애니메이션 도중 새로고침 · 빠른 더블 탭: 별·미션 상태 불일치·중복 소비 없음', async ({ page }) => {
    await seed(page, (s) => { s.mansion.ledger = stars(2); s.mansion.story.completedEvents = ['prologue']; });
    await open(page, '/mansion/living');
    await page.getByTestId('hotspot-A1').click();
    await page.getByTestId('task-confirm-go').dblclick();
    await page.waitForTimeout(600);
    await open(page, '/mansion/living'); // 연출 도중 종료
    let saved = await readSaved(page);
    expect(saved!.state.mansion.renovations.A1.status).toBe('completed');
    expect(saved!.state.mansion.ledger.filter((e) => e.type === 'spend')).toHaveLength(1);
    // 재입장 시 연결된 스토리(소파 밑 편지)가 다시 실행되고, 청소된 상태로 보인다
    await expect(page.getByTestId('mansion-world')).toHaveAttribute('data-cleaned', '1');
    await expect(page.getByTestId('dialog')).toBeVisible();
    await finishScene(page);
    saved = await readSaved(page);
    expect(saved!.state.mansion.story.completedEvents).toContain('ch1-clean');
    await expect(page.getByTestId('mansion-stars')).toContainText('1');
  });

  test('카메라: 드래그 이동 · 휠 줌 · 잠긴 공간 포커스 (방 이동 없이 같은 맵)', async ({ page }) => {
    await seed(page, (s) => { s.mansion.story.completedEvents = ['prologue']; });
    await open(page, '/mansion/living');
    await expect(page.getByTestId('mansion-world')).toBeVisible();
    await page.waitForTimeout(400); // 첫 배치·패널 폭 반영이 끝난 뒤
    const worldEl = page.getByTestId('mansion-camera').locator('> div').first();
    const t0 = await worldEl.evaluate((e) => (e as HTMLElement).style.transform);
    await page.mouse.move(420, 200); await page.mouse.down(); await page.mouse.move(300, 160, { steps: 6 }); await page.mouse.up();
    const t1 = await worldEl.evaluate((e) => (e as HTMLElement).style.transform);
    expect(t1).not.toBe(t0);
    await page.mouse.wheel(0, -300);
    const t2 = await worldEl.evaluate((e) => (e as HTMLElement).style.transform);
    expect(t2).not.toBe(t1);
    await page.getByTestId('room-kitchen').dispatchEvent('click');
    await expect(page.getByTestId('toast')).toContainText('주방');
    await expect(page).toHaveURL(/#\/mansion\/living$/);
  });
});

test.describe('전체 저택 맵 (1단계)', () => {
  test.use({ viewport: LANDSCAPE });
  test('잠긴 공간 구름·안내, 거실 확대 이동, 돌아오기', async ({ page }) => {
    await seed(page, (s) => { s.mansion.story.completedEvents = ['prologue']; });
    await open(page, '/mansion');
    await expect(page.getByTestId('map-room-living')).toHaveAttribute('data-unlocked', '1');
    for (const r of ['kitchen', 'bedroom', 'study', 'bath', 'garden']) await expect(page.getByTestId(`map-room-${r}`)).toHaveAttribute('data-unlocked', '0');
    await expect(page.getByTestId('cloud-kitchen').first()).toBeVisible();
    await expect(page.getByTestId('map-living-dust')).toHaveCount(1);
    await page.getByTestId('room-tab-kitchen').click();
    await expect(page.getByTestId('toast')).toContainText('거실 리모델링을 완성하면');
    await page.getByTestId('menu-quests').click();
    await expect(page.getByTestId('toast')).toContainText('다음 단계');
    await page.getByTestId('map-room-living').click();
    await expect(page.getByTestId('mansion-screen')).toBeVisible();
    await page.getByTestId('back-map').click();
    await expect(page.getByTestId('map-screen')).toBeVisible();
    await page.getByTestId('menu-learn').click();
    await expect(page).toHaveURL(/#\/learn$/);
  });
  test('거실 완성 → 주방 해금(구름 걷힘), 거실 원래 색, 진행 상태 공유', async ({ page }) => {
    await seed(page, (s) => {
      s.mansion.renovations = Object.fromEntries(['A1','A2','A3','A4','A5','A6','A7','B8','B9','B10','B11','B12','B13','B14','C15','C16','C17','C18','C19','C20','C21','C22','D23','D24','D25','D26','D27','D28','E29','E30','E31','E32','E33','E34','E35','E36','E37','E38','E39','E40'].map((id) => [id, { taskId: id, status: 'completed', completedAt: '2026-11-04' }]));
      s.mansion.story.completedEvents = [...STORY_DONE_TO_KEY, 'ch1-pattern', 'ch1-photo', 'ch1-finale'];
    });
    await open(page, '/mansion');
    await expect(page.getByTestId('map-room-kitchen')).toHaveAttribute('data-unlocked', '1');
    await expect(page.getByTestId('cloud-kitchen')).toHaveCount(0);
    await expect(page.getByTestId('cloud-bedroom').first()).toBeVisible();
    await expect(page.getByTestId('map-living-dust')).toHaveCount(0);
    await expect(page.getByTestId('map-progress')).toContainText('40/40');
    await page.getByTestId('map-room-kitchen').click();
    await expect(page.getByTestId('toast')).toContainText('준비 중');
  });
});

test.describe('화면 방향', () => {
  test('세로 화면에서 저택 진입 → 회전 안내, 학습 도중 회전해도 진행 유지', async ({ page }) => {
    await page.setViewportSize(PORTRAIT);
    await seed(page, (s) => { s.mansion.story.completedEvents = ['prologue']; });
    await open(page, '/mansion/living');
    await expect(page.getByTestId('rotate-overlay')).toHaveAttribute('data-want', 'landscape');
    await page.getByTestId('rotate-dismiss').click();
    await expect(page.getByTestId('rotate-overlay')).toHaveCount(0);
    await open(page, '/learn/stage/voc-a1-u01');
    await page.getByTestId('stage-start').click();
    const { answerCurrent } = await import('./helpers');
    await answerCurrent(page, true);
    await page.getByRole('button', { name: '다음 문제' }).click();
    await expect(page.getByText('2 / 5')).toBeVisible();
    await page.setViewportSize(LANDSCAPE);
    await expect(page.getByTestId('rotate-overlay')).toHaveAttribute('data-want', 'portrait');
    await page.setViewportSize(PORTRAIT);
    await expect(page.getByTestId('rotate-overlay')).toHaveCount(0);
    await expect(page.getByText('2 / 5')).toBeVisible(); // 회전 후에도 진행 유지
  });
});
