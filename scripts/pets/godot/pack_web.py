#!/usr/bin/env python3
"""Godot 내보내기(export/ice_leopard_s1.anim.json) + 파츠 → 웹 게임용 묶음.
public/assets/pets/rigs/ice_leopard_s1/{parts *.webp, anim.json}
웹에서는 프레임마다 파츠 변환 행렬로 그린다 → 해상도와 무관하게 선명, 용량 작음."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
G = ROOT / 'godot/egg_island_pets'
PARTS = G / 'parts/ice_leopard_s1'
OUT = ROOT / 'public/assets/pets/rigs/ice_leopard_s1'
OUT.mkdir(parents=True, exist_ok=True)
rig = json.loads((PARTS / 'rig.json').read_text())
data = json.loads((G / 'export/ice_leopard_s1.anim.json').read_text())
files = {}
for rk, prefix in [('walk', 'WalkRig'), ('idle', 'IdleRig'), ('pet_react', 'ReactRig')]:
    for p in rig[rk]['parts']:
        files[f"{prefix}/{p['name']}" if p['name'] != 'body' else f'{prefix}/body'] = p['file']
for n, c in rig['closeup'].items():
    files[n] = c['file']
parts = {}
for key, meta in data['parts'].items():
    src = files[key]
    webp = src.replace('.png', '.webp')
    Image.open(PARTS / src).save(OUT / webp, 'WEBP', quality=92, method=6, alpha_quality=100)
    parts[key] = {'file': webp, 'w': meta['w'], 'h': meta['h'], 'z': meta['z']}
data['parts'] = parts
(OUT / 'anim.json').write_text(json.dumps(data, separators=(',', ':')))
print(len(parts), 'parts', sum(f.stat().st_size for f in OUT.iterdir()) // 1024, 'KB')
