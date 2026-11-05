import type { Page } from '@playwright/test';
import { initialState, STORE_KEY, STORE_VERSION } from '../src/store/app';

/** 온보딩·레벨 진단을 마친 저장 상태를 IndexedDB 에 심고 시작 (patch 로 저택 상태 등을 덮어쓰기) */
export async function seed(page: Page, patch: (s: ReturnType<typeof initialState>) => void = () => {}) {
  const s = initialState();
  s.profile.onboarded = true;
  s.profile.levelTest = { done: true, level: 'A1', byLevel: null };
  s.settings.sound = false;
  patch(s);
  const { celebrations: _c, recovered: _r, ...rest } = s;
  const json = JSON.stringify({ state: { ...rest, celebrations: [] }, version: STORE_VERSION });
  await page.goto('/#/onboarding');
  await page.evaluate(async ([key, value]) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('keyval-store');
      req.onupgradeneeded = () => req.result.createObjectStore('keyval');
      req.onsuccess = () => {
        const tx = req.result.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, [STORE_KEY, json] as const);
}

/** 저장된 상태 읽기 */
export async function readSaved(page: Page) {
  return page.evaluate(async (key) => new Promise<unknown>((resolve) => {
    const req = indexedDB.open('keyval-store');
    req.onsuccess = () => {
      const g = req.result.transaction('keyval').objectStore('keyval').get(key);
      g.onsuccess = () => resolve(g.result ? JSON.parse(g.result as string) : null);
    };
  }), STORE_KEY) as Promise<{ state: ReturnType<typeof initialState> } | null>;
}

export const LANDSCAPE = { width: 844, height: 390 };
export const PORTRAIT = { width: 390, height: 844 };

/** 해시 라우트로 이동 + 새로고침 (심어 둔 저장 상태를 다시 불러오기) */
export async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/#${hash}`);
}
