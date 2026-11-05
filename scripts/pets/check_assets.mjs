// 에셋 연결 검사: 27종 × 3단계 아틀라스가 모두 있고, 모션 등록부가 쓰는 프레임이 빠짐없이 있으며,
// 아틀라스에 있는데 어떤 모션에도 쓰이지 않는 프레임(미사용 에셋)이 없는지 확인한다.
// 실행: node scripts/pets/check_assets.mjs  (실패 시 exit 1)
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const atlas = JSON.parse(readFileSync(resolve(root, 'src/pets/generated/atlas.json'), 'utf8'));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const slugs = [...read('src/data/species.ts').matchAll(/s\('\w+', '[ABC]', '(\w+)'/g)].map((m) => m[1]);
const motionFrames = new Set([...read('src/data/motions.ts').matchAll(/frames: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([\w]+)'/g)].map((x) => x[1])));

const errors = [];
const unused = new Set();
let frames = 0, bytes = 0;
const file = (rel) => { const p = resolve(root, 'public/assets/pets', rel); if (!existsSync(p)) { errors.push(`파일 없음: ${rel}`); return; } bytes += statSync(p).size; };

if (slugs.length !== 27) errors.push(`등록된 종 수 ${slugs.length} (27 이어야 함)`);
for (const slug of slugs) {
  const pet = atlas.pets[slug];
  if (!pet) { errors.push(`아틀라스 없음: ${slug}`); continue; }
  for (const st of ['s1', 's2', 's3']) {
    const s = pet.stages[st];
    if (!s) { errors.push(`${slug} ${st} 없음`); continue; }
    file(s.atlas);
    for (const f of motionFrames) if (!s.frames[f]) errors.push(`${slug} ${st}: 프레임 '${f}' 없음`);
    for (const f of Object.keys(s.frames)) { frames++; if (!motionFrames.has(f)) unused.add(f); }
  }
  if (pet.lineup) file(pet.lineup.file); else errors.push(`${slug}: 라인업 없음`);
}
for (const [a, e] of Object.entries(atlas.eggs)) file(e.file);
if (Object.keys(atlas.eggs).length !== 9) errors.push('알 9종이 아님');
const fx = atlas.extra.fire_fox;
for (const e of [...fx.evolution_s2_s3, ...Object.values(fx.turnaround).flat(), ...fx.emotion_icons]) file(e.file);

console.log(`종 ${slugs.length} · 단계 아틀라스 ${slugs.length * 3} · 프레임 ${frames} · 알 ${Object.keys(atlas.eggs).length} · 불꽃 여우 전용 ${fx.evolution_s2_s3.length + Object.values(fx.turnaround).flat().length + fx.emotion_icons.length} · 용량 ${(bytes / 1048576).toFixed(1)}MB`);
if (unused.size) errors.push(`모션에 연결되지 않은 프레임: ${[...unused].join(', ')}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('OK — 누락·미사용 프레임 없음');
