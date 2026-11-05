/** 2단계 결과 스크린샷 (docs/stage2/shots) — `npx playwright test e2e/stage2-shots.spec.ts` */
import { expect, test } from '@playwright/test';
import { seed, open, LANDSCAPE } from './mansion-helpers';
import { LIVING_TASKS } from '../src/content/mansion/tasks';

const DIR = 'docs/stage2/shots';
const EV = ['prologue', 'ch1-clean', 'ch1-letter', 'ch1-key', 'ch1-pattern', 'ch1-photo', 'ch1-finale'];
const done = (ids: string[], pick: (id: string) => string | undefined) =>
  Object.fromEntries(ids.map((id) => [id, { taskId: id, status: 'completed', completedAt: '2026-11-04', ...(pick(id) ? { selectedVariantId: pick(id) } : {}) }]));
const ready = LIVING_TASKS.filter((t) => t.ready !== false);

test.use({ viewport: LANDSCAPE, deviceScaleFactor: 2 });
test('1 처음 거실 (모든 작업 전)', async ({ page }) => {
  await seed(page, (s) => { s.mansion.story.completedEvents = ['prologue']; });
  await open(page, '/mansion/living');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/1-before.png` });
});
test('2 준비된 작업 완료 — 원본 디자인', async ({ page }) => {
  await seed(page, (s) => { s.mansion.renovations = done(ready.map((t) => t.id), (id) => LIVING_TASKS.find((t) => t.id === id)!.variants?.[0].id); s.mansion.story.completedEvents = EV; });
  await open(page, '/mansion/living');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/2-after-original.png` });
});
test('3 준비된 작업 완료 — 두 번째 디자인', async ({ page }) => {
  await seed(page, (s) => { s.mansion.renovations = done(ready.map((t) => t.id), (id) => { const v = LIVING_TASKS.find((t) => t.id === id)!.variants; return v?.[1]?.id; }); s.mansion.story.completedEvents = EV; });
  await open(page, '/mansion/living');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/3-after-design2.png` });
});
test('4 디자인 선택 패널 (벽 액자)', async ({ page }) => {
  const before = ready.slice(0, ready.findIndex((t) => t.id === 'E29')).map((t) => t.id);
  await seed(page, (s) => {
    s.mansion.ledger = [{ id: 'seed', idempotencyKey: 'earn:seed', type: 'earn', amount: 3, sourceId: 'seed', createdAt: '2026-11-04' }];
    s.mansion.renovations = done(before, (id) => LIVING_TASKS.find((t) => t.id === id)!.variants?.[0].id); s.mansion.story.completedEvents = EV;
  });
  await open(page, '/mansion/living');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/4a-panel.png` });
  await page.getByTestId('hotspot-E29').click();
  await page.getByTestId('variant-frame-ship').click();
  await expect(page.getByTestId('variant-layer-E29')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/4b-variant-tray.png` });
  await page.getByTestId('variant-cancel').click();
  await page.getByTestId('open-board').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/4c-board.png` });
});
