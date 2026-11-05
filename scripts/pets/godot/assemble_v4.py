#!/usr/bin/env python3
"""
v4 파츠(새로 그린 리깅용 파츠) 조립 배치 — 옆모습(걷기·달리기)과 정면(대기·쓰다듬기).

각 파츠의 '연결점'(앵커)과 '붙는 자리'를 몸통 기준 좌표로 정하고, 원본 키포즈와 같은 비율·크기로 맞춘다.
출력: regen_v4/layout.json (Godot 리그 입력), check/1_side_assembled.png, check/2_front_assembled.png
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[3]
D = ROOT / 'art/pets/godot_src/ice_leopard_s1/regen_v4'
P = D / 'parts'

# 옆모습: 파츠 이미지 안의 앵커(관절 중심) → 몸통 이미지 좌표의 붙는 자리, 회전(rad), z
SIDE = {
    'torso': {'file': 'side_torso.png', 'anchor': (300, 200), 'at': (300, 200), 'z': 0},
    'head': {'file': 'side_head.png', 'anchor': (232, 455), 'at': (560, 170), 'rot': 0.0, 'z': 3, 'scale': 1.32},
    'tail': {'file': 'side_tail.png', 'anchor': (222, 455), 'at': (75, 135), 'rot': -0.3, 'z': -3, 'scale': 1.05},
    'leg_hind_far': {'file': 'side_leg_hind.png', 'anchor': (178, 95), 'at': (200, 240), 'rot': 0.0, 'z': -2, 'far': True, 'scale': 0.82},
    'leg_front_far': {'file': 'side_leg_front.png', 'anchor': (118, 85), 'at': (455, 245), 'rot': 0.0, 'z': -1, 'far': True, 'scale': 0.82},
    'leg_hind_near': {'file': 'side_leg_hind.png', 'anchor': (178, 95), 'at': (140, 250), 'rot': 0.0, 'z': 2, 'scale': 0.82},
    'leg_front_near': {'file': 'side_leg_front.png', 'anchor': (118, 85), 'at': (520, 255), 'rot': 0.0, 'z': 4, 'scale': 0.82},
}
FRONT = {
    'body': {'file': 'front_body.png', 'anchor': (274, 288), 'at': (274, 288), 'z': 0},
    'head': {'file': 'front_head.png', 'anchor': (345, 540), 'at': (274, 150), 'rot': 0.0, 'z': 2, 'scale': 1.12},
    'tail': {'file': 'front_tail.png', 'anchor': (330, 420), 'at': (150, 500), 'rot': 0.1, 'z': -1, 'scale': 0.82},
}
FAR_TINT = (0.86, 0.87, 0.92)


def place(spec, extra_rot=None):
    extra_rot = extra_rot or {}
    items = []
    for n, s in spec.items():
        im = Image.open(P / s['file']).convert('RGBA')
        if s.get('far'):
            a = np.asarray(im).astype(np.float32)
            a[..., :3] *= np.array(FAR_TINT)
            im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
        r = s.get('rot', 0.0) + extra_rot.get(n, 0.0)
        ax, ay = s['anchor']
        sc = s.get('scale', 1.0)
        if sc != 1.0:
            im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
            ax, ay = ax * sc, ay * sc
        if r:
            # 앵커를 중심으로 회전 (확장해서 잘리지 않게)
            w, h = im.size
            big = Image.new('RGBA', (w * 3, h * 3))
            big.alpha_composite(im, (w, h))
            big = big.rotate(-math.degrees(r), resample=Image.BICUBIC, center=(w + ax, h + ay))
            bb = big.getbbox()
            im = big.crop(bb)
            ax, ay = w + ax - bb[0], h + ay - bb[1]
        items.append((s['z'], n, im, (s['at'][0] - ax, s['at'][1] - ay)))
    items.sort(key=lambda t: t[0])
    x0 = min(p[0] for *_, p in items)
    y0 = min(p[1] for *_, p in items)
    x1 = max(p[0] + im.width for _, _, im, p in items)
    y1 = max(p[1] + im.height for _, _, im, p in items)
    canvas = Image.new('RGBA', (int(x1 - x0), int(y1 - y0)))
    for _, n, im, p in items:
        canvas.alpha_composite(im, (int(p[0] - x0), int(p[1] - y0)))
    return canvas, (x0, y0)


def on(bg, im, h=520):
    im = im.copy()
    im.thumbnail((10000, h))
    b = Image.new('RGBA', (im.width + 40, h + 40), bg + (255,))
    b.alpha_composite(im, (20, 20))
    return b


def row(cells):
    W = sum(c.width for c in cells) + 12 * (len(cells) - 1)
    H = max(c.height for c in cells)
    S = Image.new('RGB', (W, H), (255, 255, 255))
    x = 0
    for c in cells:
        S.paste(c.convert('RGB'), (x, 0))
        x += c.width + 12
    return S


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else None
    orig_side = Image.open(ROOT / 'art/pets/godot_src/ice_leopard_s1/hd/pose_walk.webp').convert('RGBA')
    orig_front = Image.open(ROOT / 'art/pets/godot_src/ice_leopard_s1/hd/pose_idle.webp').convert('RGBA')
    side, _ = place(SIDE)
    front, _ = place(FRONT)
    ext, _ = place(SIDE, {'leg_front_near': -0.45, 'leg_hind_far': -0.45, 'leg_front_far': 0.45, 'leg_hind_near': 0.45, 'tail': 0.2})
    L, Dk = (236, 241, 248), (34, 32, 48)
    row([on(L, orig_side), on(L, side), on(Dk, side), on(Dk, ext)]).save(D / 'check' / '1_side_assembled.png')
    row([on(L, orig_front), on(L, front), on(Dk, front)]).save(D / 'check' / '2_front_assembled.png')
    if out:
        Image.open(D / 'check' / '1_side_assembled.png').save(out)


if __name__ == '__main__' and len(sys.argv) == 1:
    main()


def export(spec, view, target_h):
    """Godot 리그 입력: 최종 크기로 줄인 파츠 png + layout.json (원점 = 발밑 가운데, 피벗 = 관절)."""
    out = ROOT / f'godot/egg_island_pets/parts/ice_leopard_s1_v4/{view}'
    out.mkdir(parents=True, exist_ok=True)
    canvas, (x0, y0) = place(spec)
    bb = canvas.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
    g = target_h / (bb[3] - bb[1])
    ground = y0 + bb[3]                                # 조립 좌표에서 발밑 (그림 실제 아래 끝)
    cx = x0 + (bb[0] + bb[2]) / 2
    root = [n for n, s in spec.items() if s['anchor'] == s['at'] and not s.get('rot')][0]
    lay = {'scale': g, 'size': [(bb[2] - bb[0]) * g, (bb[3] - bb[1]) * g], 'parts': {}}
    for n, s in spec.items():
        im = Image.open(P / s['file']).convert('RGBA')
        if s.get('far'):
            a = np.asarray(im).astype(np.float32)
            a[..., :3] *= np.array(FAR_TINT)
            im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
        sc = s.get('scale', 1.0) * g
        im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
        im.save(out / f'{n}.png')
        ax, ay = s['anchor'][0] * sc, s['anchor'][1] * sc
        lay['parts'][n] = {'file': f'{n}.png', 'z': s['z'], 'parent': None if n == root else root,
                           'pivot': [(s['at'][0] - cx) * g, (s['at'][1] - ground) * g],   # 발밑 원점 기준
                           'offset': [-ax, -ay], 'rot': s.get('rot', 0.0)}
    (out / 'layout.json').write_text(json.dumps(lay, indent=1))
    print(view, 'scale', round(g, 3), 'size', [round(v) for v in lay['size']])


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'export':
    export(SIDE, 'side', 560)
    export(FRONT, 'front', 680)
