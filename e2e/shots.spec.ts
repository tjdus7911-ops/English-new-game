/** 시각 점검용 캡처 (SHOTS=1 일 때만) */
import { test } from '@playwright/test';
import { seed, open, LANDSCAPE } from './mansion-helpers';

test.skip(!process.env.SHOTS, 'SHOTS=1 일 때만');
test('mansion landscape shots', async ({ page }) => {
  await page.setViewportSize(LANDSCAPE);
  await seed(page, (s) => {
    s.mansion.ledger = [{ id: 't1', idempotencyKey: 'earn:stage:x', type: 'earn', amount: 3, sourceId: 'x', createdAt: '2026-11-04' }];
  });
  await open(page, '/mansion/living');
  await page.waitForTimeout(1500);
  await page.getByTestId('skip').click();
  await page.getByTestId('quiz-choice-1').click();
  await page.screenshot({ path: 'qa/mansion/03-quiz-wrong.png' });
  await page.getByTestId('quiz-choice-0').click();
  await page.screenshot({ path: 'qa/mansion/04-quiz-solved.png' });
  await page.getByTestId('quiz-continue').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/mansion/05-clue.png' });
  await page.getByTestId('clue-close').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/mansion/06-dialog.png' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa/mansion/07-home.png' });
  await page.getByTestId('open-board').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/mansion/08-board.png' });
  await page.getByTestId('mission-run-A1').click();
  await page.waitForTimeout(300);
  await page.getByTestId('task-confirm-go').click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'qa/mansion/09-sweep.png' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'qa/mansion/10-sweep2.png' });
});
