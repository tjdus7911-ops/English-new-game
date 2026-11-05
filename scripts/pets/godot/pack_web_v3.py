#!/usr/bin/env python3
"""
Godot 렌더 프레임(godot/egg_island_pets/export/frames/ice_leopard_s1_v3/<anim>/) → 모바일 웹용 스프라이트 시트.

- 모션별 배율로 줄인 뒤 webp 시트(한 장 최대 4096px — 모바일 GPU 텍스처 한도)로 묶는다.
- 출력: public/assets/pets/anim/ice_leopard_s1/<anim>_<n>.webp + manifest.json
  manifest: fps, frames, loop, frame(w,h), origin(발밑 가운데, 프레임 좌표), speed(걷기·달리기 이동 px/초, 프레임 px 기준),
            hd_scale(원본 HD 대비 배율 — 모션끼리 캐릭터 크기를 맞출 때 frame_px / hd_scale 로 환산), sheets
"""
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
import os
RIG = os.environ.get('RIG', 'ice_leopard_s1_v4')
SRC = ROOT / f'godot/egg_island_pets/export/frames/{RIG}'
INFO = ROOT / f'godot/egg_island_pets/export/{RIG}.anims.json'
OUT = ROOT / 'public/assets/pets/anim/ice_leopard_s1'
SCALE = {'walk': 0.75, 'run': 0.75, 'idle': 0.7, 'pet_react': 0.7, 'nuzzle': 0.6}
MAX = 4096
Q = 84


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    info = json.loads(INFO.read_text())
    man = {'pet': 'PET_SNOW_C', 'slug': 'ice_leopard', 'stage': 1, 'source': f'Godot 리그 {RIG}', 'anims': {}}
    total = 0
    mem = 0
    for name, sc in SCALE.items():
        a = info[name]
        files = sorted((SRC / name).glob('*.png'))
        # 모든 프레임의 그림 영역 합집합으로 잘라 빈 여백 제거 (메모리 절약)
        bb = None
        for f in files:
            b = Image.open(f).getchannel('A').getbbox()
            if b:
                bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
        pad = 6
        bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(a['canvas'][0], bb[2] + pad), min(a['canvas'][1], bb[3] + pad))
        fw, fh = round((bb[2] - bb[0]) * sc), round((bb[3] - bb[1]) * sc)
        cols = MAX // fw
        rows = MAX // fh
        per = cols * rows
        sheets = []
        for si in range(math.ceil(len(files) / per)):
            chunk = files[si * per:(si + 1) * per]
            c = min(cols, len(chunk))
            r = math.ceil(len(chunk) / c)
            sheet = Image.new('RGBA', (c * fw, r * fh), (0, 0, 0, 0))
            for i, f in enumerate(chunk):
                im = Image.open(f).convert('RGBA').crop(bb).resize((fw, fh), Image.LANCZOS)
                sheet.paste(im, ((i % c) * fw, (i // c) * fh))
            fn = f'{name}_{si}.webp'
            sheet.save(OUT / fn, quality=Q, method=6)
            size = (OUT / fn).stat().st_size
            total += size
            sheets.append({'file': fn, 'cols': c, 'rows': r, 'count': len(chunk)})
            mem += sheet.width * sheet.height * 4
            print(f'{fn}: {sheet.width}x{sheet.height} {len(chunk)}프레임 {size / 1024:.0f}KB')
        man['anims'][name] = {'fps': a['fps'], 'frames': len(files), 'loop': a['loop'], 'frame': [fw, fh],
                              'origin': [round((a['origin'][0] - bb[0]) * sc, 1), round((a['origin'][1] - bb[1]) * sc, 1)],
                              'speed': round(a['speed_px_s'] * sc, 2), 'hd_scale': sc, 'sheets': sheets}
    (OUT / 'manifest.json').write_text(json.dumps(man, ensure_ascii=False, indent=1))
    print(f'합계 {total / 1024 / 1024:.2f}MB, 모두 펼쳤을 때 메모리 {mem / 1024 / 1024:.0f}MB')


if __name__ == '__main__':
    main()
