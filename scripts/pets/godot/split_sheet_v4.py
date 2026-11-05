#!/usr/bin/env python3
"""
리깅용 파츠 시트(ChatGPT/Gemini 생성, 흰 배경) → 투명 배경 개별 파츠.

1) rembg(isnet) 로 배경 제거 + 흰 배경과의 색 거리로 가장자리 보정
2) 떨어져 있는 덩어리(연결 요소)마다 파츠 하나 — 위치로 이름을 붙인다
출력: art/pets/godot_src/ice_leopard_s1/regen_v4/parts/<view>_<part>.png, check/*.png
"""
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

os.environ.setdefault('U2NET_HOME', '/root/.rembg/models')
ROOT = Path(__file__).resolve().parents[3]
D = ROOT / 'art/pets/godot_src/ice_leopard_s1/regen_v4'


def cutout(path):
    from rembg import new_session, remove
    im = Image.open(path).convert('RGB')
    sess = new_session('isnet-general-use')
    m = np.asarray(remove(im, session=sess, only_mask=True)).astype(np.float32) / 255
    rgb = np.asarray(im).astype(np.float32)
    # 흰 배경과 거의 같은 색은 투명 쪽으로 (털 끝의 배경 섞임 제거)
    dist = np.sqrt(((255 - rgb) ** 2).sum(-1))
    soft = np.clip((dist - 6) / 22, 0, 1)
    a = np.where(m > 0.98, 1.0, np.minimum(m * 1.15, np.maximum(m, soft) * m ** 0.3))
    a = np.clip(a, 0, 1)
    # 반투명 가장자리 색에서 흰 배경을 빼서 원래 털 색으로 (흰 테 방지)
    aa = np.maximum(a, 1e-3)[..., None]
    rgb_u = np.where(a[..., None] > 0.03, (rgb - 255 * (1 - aa)) / aa, rgb)
    return np.clip(rgb_u, 0, 255), a


def pieces(a, min_area=4000):
    m = (a > 0.2).astype(np.uint8)
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    out = []
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= min_area:
            x, y, w, h = st[i, :4]
            out.append({'id': i, 'bbox': [int(x), int(y), int(x + w), int(y + h)], 'c': cen[i].tolist(), 'area': int(st[i, 4])})
    return lab, out


def save(rgb, a, lab, p, name, pad=24):
    x0, y0, x1, y1 = p['bbox']
    mask = (lab[y0:y1, x0:x1] == p['id'])
    sub_a = a[y0:y1, x0:x1] * mask
    sub = np.dstack([rgb[y0:y1, x0:x1], sub_a * 255]).astype(np.uint8)
    sub = np.pad(sub, ((pad, pad), (pad, pad), (0, 0)))
    Image.fromarray(sub, 'RGBA').save(D / 'parts' / f'{name}.png')
    return {'file': f'{name}.png', 'sheet_bbox': p['bbox'], 'size': [sub.shape[1], sub.shape[0]]}


def main():
    (D / 'parts').mkdir(parents=True, exist_ok=True)
    (D / 'check').mkdir(exist_ok=True)
    meta = {}
    # 옆모습: 위 줄 왼쪽=머리, 오른쪽=몸통 / 아래 줄 왼쪽→오른쪽 = 앞다리, 뒷다리, 꼬리
    rgb, a = cutout(D / 'src/side_sheet.png')
    lab, ps = pieces(a)
    ps.sort(key=lambda p: p['c'][1])
    top = sorted([p for p in ps if p['c'][1] < a.shape[0] * 0.5], key=lambda p: p['c'][0])
    bot = sorted([p for p in ps if p['c'][1] >= a.shape[0] * 0.5], key=lambda p: p['c'][0])
    assert len(top) == 2 and len(bot) == 3, (len(top), len(bot))
    for p, n in zip(top + bot, ['side_head', 'side_torso', 'side_leg_front', 'side_leg_hind', 'side_tail']):
        meta[n] = save(rgb, a, lab, p, n)
    # 정면: 왼쪽→오른쪽 = 머리, 몸통, 꼬리
    rgb, a = cutout(D / 'src/front_sheet.png')
    lab, ps = pieces(a)
    ps.sort(key=lambda p: p['c'][0])
    assert len(ps) == 3, len(ps)
    for p, n in zip(ps, ['front_head', 'front_body', 'front_tail']):
        meta[n] = save(rgb, a, lab, p, n)
    (D / 'parts' / 'parts.json').write_text(json.dumps(meta, indent=1))
    # 검수: 어두운·밝은 배경
    cells = []
    for n in meta:
        im = Image.open(D / 'parts' / meta[n]['file'])
        for bg in ((34, 32, 48), (236, 241, 248)):
            b = Image.new('RGBA', im.size, bg + (255,))
            b.alpha_composite(im)
            b.thumbnail((300, 300))
            cells.append(b)
    S = Image.new('RGB', (300 * 4, 300 * ((len(cells) + 3) // 4)), (255, 255, 255))
    for i, c in enumerate(cells):
        S.paste(c, ((i % 4) * 300, (i // 4) * 300))
    S.save(D / 'check' / '0_cutout.png')
    print(json.dumps({k: v['size'] for k, v in meta.items()}))


if __name__ == '__main__':
    main()
