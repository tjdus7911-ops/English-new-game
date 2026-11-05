/**
 * 리모델링 미션 v1(R01~R10, 14별) → v2(L01~L11, 20별) 마이그레이션.
 * - 이미 완료한 미션은 완료 상태 유지 (대응하는 새 작업을 완료 처리, 별을 다시 요구하지 않음)
 * - 이미 쓴 별은 원장에 그대로 (spend:task:R0x 기록 보존)
 * - 선택한 가구 디자인 유지 (variant id 이전, 안락의자·장식장 같은 새 구조에 없는 선택은 keep 으로 보존)
 * - 원본 기록은 legacyRenovations 에 보관
 */
import type { MansionState, RenovationProgress } from './types';

const SOFA_SET: Record<string, string> = { 'sofa-green': 'sofa-green', 'sofa-pink': 'sofa-pink', 'sofa-cloud': 'sofa-cloud' };
const ARMCHAIR: Record<string, string> = { 'arm-rose': 'a/armchair-rose', 'arm-sage': 'a/armchair-green', 'arm-rattan': 'a/armchair-leather' };
const CABINET: Record<string, string> = { 'cab-small': 'a/bookshelf-low', 'cab-tall': 'a/bookshelf-tall', 'cab-acorn': 'a/china-cabinet' };

export function migrateRenovationsV2(m: MansionState): MansionState {
  const old = m.renovations;
  const hasLegacy = Object.keys(old).some((k) => /^R\d\d$/.test(k));
  if (!hasLegacy) return m;
  const out: Record<string, RenovationProgress> = {};
  for (const [k, v] of Object.entries(old)) if (!/^R\d\d$/.test(k)) out[k] = v; // 이미 새 구조인 기록은 유지
  const done = (id: string) => old[id]?.status === 'completed';
  const put = (id: string, from: string, variant?: string, keep?: Record<string, string>) => {
    if (out[id]) return;
    out[id] = { taskId: id, status: 'completed', completedAt: old[from]?.completedAt ?? new Date(0).toISOString(), migratedFrom: from, ...(variant ? { selectedVariantId: variant } : {}), ...(keep ? { keep } : {}) };
  };
  if (done('R01')) { put('L01', 'R01'); put('L02', 'R01'); put('L03', 'R01'); }
  if (done('R02')) { put('L04', 'R02'); put('L05', 'R02', old.R02.selectedVariantId); }
  if (done('R04')) put('L06', 'R04', old.R04.selectedVariantId);
  if (done('R07')) put('L07', 'R07', old.R07.selectedVariantId);
  const keepArm = done('R03') && old.R03.selectedVariantId ? ARMCHAIR[old.R03.selectedVariantId] : undefined;
  if (done('R05')) put('L08', 'R05', SOFA_SET[old.R05.selectedVariantId ?? ''] ?? 'sofa-green', keepArm ? { armchair: keepArm } : undefined);
  if (done('R06')) put('L09', 'R06', old.R06.selectedVariantId);
  if (done('R08')) put('L10', 'R08', old.R08.selectedVariantId);
  if (done('R10')) put('L11', 'R10', 'deco-forest');
  // 새 구조에 없는 선택(소파 전 안락의자, 장식장)은 보존 레이어로 남김
  const legacyKeep: Record<string, string> = {};
  if (keepArm && !out.L08) legacyKeep.armchair = keepArm;
  if (done('R09') && old.R09.selectedVariantId) legacyKeep.cabinet = CABINET[old.R09.selectedVariantId];
  return { ...m, renovations: out, ...(Object.keys(legacyKeep).length ? { legacyKeep: { ...(m.legacyKeep ?? {}), ...legacyKeep } } : {}), legacyRenovations: { ...(m.legacyRenovations ?? {}), ...Object.fromEntries(Object.entries(old).filter(([k]) => /^R\d\d$/.test(k))) } };
}

/**
 * 리모델링 미션 v2(L01~L11, 20별) → v3(A1~E40, 40개) 마이그레이션.
 * - 끝낸 미션에 대응하는 새 작업을 완료 처리 (별을 다시 요구하지 않음 · 원장 spend:task:Lxx 그대로)
 * - 고른 디자인 유지: 벽(L05)·바닥(L06)·소파(L08)·테이블(L09)·러그(L10)·조명(L07) 선택을 새 작업으로 옮김
 * - 장식(L11) 선택은 새 화분 작업 E33 의 첫 디자인으로 (이전 선택은 legacyKeep 에 보관)
 * - 원본 기록은 legacyRenovations 에 보관. 여러 번 불러도 결과가 같다(멱등)
 */
export function migrateRenovationsV3(m: MansionState): MansionState {
  const old = m.renovations;
  const isL = (k: string) => /^L\d\d$/.test(k);
  if (!Object.keys(old).some(isL)) return m;
  const out: Record<string, RenovationProgress> = {};
  for (const [k, v] of Object.entries(old)) if (!isL(k)) out[k] = v;
  const done = (id: string) => old[id]?.status === 'completed';
  const put = (id: string, from: string, variant?: string) => {
    if (out[id]) return;
    const src = old[from];
    out[id] = { taskId: id, status: 'completed', completedAt: src?.completedAt ?? new Date(0).toISOString(), migratedFrom: from, ...(variant ? { selectedVariantId: variant } : {}), ...(src?.keep ? { keep: src.keep } : {}) };
  };
  const sel = (id: string) => old[id]?.selectedVariantId;
  if (done('L01')) { put('A1', 'L01'); put('A4', 'L01'); }
  if (done('L02')) { put('A2', 'L02'); put('A3', 'L02'); }
  if (done('L03')) put('A6', 'L03');
  if (done('L05')) put('B8', 'L05', sel('L05') ?? 'wp-flower');
  else if (done('L04')) put('B8', 'L04', 'wp-flower'); // 벽지 걷기만 끝냈어도 별을 다시 받지 않음 (색은 나중에 무료로 바꿀 수 있음)
  if (done('L06')) put('B9', 'L06', sel('L06'));
  if (done('L07')) { put('A7', 'L07'); put('B12', 'L07'); put('D23', 'L07'); put('D25', 'L07', sel('L07')); }
  if (done('L08')) { put('A5', 'L08'); put('C15', 'L08', sel('L08')); put('C16', 'L08', 'arm-green'); put('C17', 'L08', 'arm-green'); }
  if (done('L09')) put('C18', 'L09', sel('L09'));
  if (done('L10')) put('D27', 'L10', sel('L10'));
  const legacyKeep: Record<string, string> = {};
  if (done('L11')) {
    put('E33', 'L11', 'deco-forest');
    if (sel('L11') && sel('L11') !== 'deco-forest') legacyKeep.decorL11 = sel('L11')!;
  }
  return {
    ...m, renovations: out,
    ...(Object.keys(legacyKeep).length ? { legacyKeep: { ...(m.legacyKeep ?? {}), ...legacyKeep } } : {}),
    legacyRenovations: { ...(m.legacyRenovations ?? {}), ...Object.fromEntries(Object.entries(old).filter(([k]) => isL(k))) },
  };
}
