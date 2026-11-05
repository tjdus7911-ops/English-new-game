#!/usr/bin/env python3
"""
v3 파츠(art/pets/godot_src/ice_leopard_s1/parts_v3) → Godot 스키닝 메시 데이터.

각 파츠를 격자 메시로 덮고 정점마다 뼈 가중치를 계산한다.
- 몸통: body 뼈에 단단히 고정 (같은 그림 안에서 휘면 털이 늘어나 보이므로 머리는 휘지 않는다).
- 꼬리: 몸통에서 엉덩이 윤곽을 따라 떼어 낸 '단단한' 별도 층(몸통 뒤). 꼬리 뿌리는 LaMa 로 몸통 안쪽까지
  이어 그려 두어 흔들어도 잘린 면이 몸통 밖으로 드러나지 않는다.
- 다리: body / 해당 다리 뼈. 어깨·엉덩이 윗부분은 몸통에 고정(0), 발 쪽으로 갈수록 다리 뼈(1).
출력: godot/egg_island_pets/parts/ice_leopard_s1_v3/  (png 복사 + skin.json)
"""
import json
import os
import shutil
from pathlib import Path

import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import skin_common as SC  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'art/pets/godot_src/ice_leopard_s1/parts_v3'
OUT = ROOT / 'godot/egg_island_pets/parts/ice_leopard_s1_v3'
G = 8   # 격자 간격 (HD px)


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def axis_w(px, py, piv, ax, t0, t1):
    a = np.array(ax, float)
    a /= np.linalg.norm(a)
    return smooth(((px - piv[0]) * a[0] + (py - piv[1]) * a[1] - t0) / (t1 - t0))


def main():
    SC.LAMA_PATH = os.environ.get('LAMA', '/tmp/claude-0/-home-claude/748eeeb8-c914-548e-b7f0-96237bd15e7c/scratchpad/models/big-lama.pt')
    meta = json.loads((SRC / 'parts.json').read_text())
    K = meta['k']
    off = meta['pad_native']
    nat = lambda x, y: ((x + off) * K, (y + off) * K)       # 원본 좌표 → HD 캔버스
    OUT.mkdir(parents=True, exist_ok=True)
    # 바닥 가운데를 원점으로
    ground_y = nat(0, 277)[1]
    origin = [meta['canvas'][0] / 2, ground_y]
    bones = {
        'body': {'parent': None, 'pivot': nat(185, 195)},
        'head': {'parent': 'body', 'pivot': nat(244, 150)},
        'tail': {'parent': 'body', 'pivot': nat(102, 170)},
    }
    out = {'origin': origin, 'k': K, 'off': off, 'ground_y': ground_y, 'bones': bones, 'parts': {}}
    FEET = {n: nat(*f) for n, f in {'leg_hind_near': (62, 275), 'leg_hind_far': (157, 276), 'leg_front_far': (202, 277),
                                     'leg_front_near': (322, 268)}.items()}
    out['feet'] = FEET
    split_tail(meta, nat, K, out)
    for n, p in meta['parts'].items():
        if n != 'body':
            shutil.copy(SRC / p['file'], OUT / p['file'])
        im = np.asarray(Image.open(OUT / p['file']))[..., 3]
        h, w = im.shape
        nx, ny = w // G + 2, h // G + 2
        # 격자 정점 (텍스처 좌표) — 알파가 있는 칸만 사용
        idx = -np.ones((ny, nx), int)
        verts, uvs = [], []
        cells = []
        for j in range(ny - 1):
            for i in range(nx - 1):
                x0, y0 = i * G, j * G
                blk = im[max(0, y0 - 2):min(h, y0 + G + 2), max(0, x0 - 2):min(w, x0 + G + 2)]
                if blk.size and blk.max() > 0:
                    cells.append((i, j))
        for i, j in cells:
            for (a, b) in ((i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)):
                if idx[b, a] < 0:
                    idx[b, a] = len(verts)
                    u, v = min(a * G, w), min(b * G, h)
                    uvs.append([u, v])
                    verts.append([p['pos'][0] + u, p['pos'][1] + v])
        tris = []
        for i, j in cells:
            a, b, c, d = idx[j, i], idx[j, i + 1], idx[j + 1, i], idx[j + 1, i + 1]
            tris += [[int(a), int(b), int(d)], [int(a), int(d), int(c)]]
        V = np.array(verts, float)
        weights = {}
        if n == 'body':
            weights = {'body': np.ones(len(V))}
        else:
            px, py, ax, ay, t0, t1 = p['weight_axis']
            wl = smooth(((V[:, 0] - px) * ax + (V[:, 1] - py) * ay - t0) / (t1 - t0))
            # 무릎(팔꿈치): 엉덩이·어깨 피벗과 발바닥 사이 중간. 아래쪽 정강이 뼈로 발을 바닥에 붙인다(2관절 IK)
            fx, fy = FEET[n]
            kx, ky = (px + fx) / 2, (py + fy) / 2
            kax, kay = fx - px, fy - py
            kn = np.hypot(kax, kay)
            kax, kay = kax / kn, kay / kn
            wk = smooth(((V[:, 0] - kx) * kax + (V[:, 1] - ky) * kay + 7 * K) / (14 * K))
            wk = np.minimum(wk, wl)
            weights = {'body': 1 - wl, n: wl - wk, n + '_lower': wk}
            bones[n] = {'parent': 'body', 'pivot': [px, py]}
            bones[n + '_lower'] = {'parent': n, 'pivot': [kx, ky]}
        out['parts'][n] = {'file': p['file'], 'z': p['z'], 'verts': np.round(V, 2).tolist(), 'uvs': uvs, 'tris': tris,
                           'weights': {k: np.round(v, 4).tolist() for k, v in weights.items()}}
        print(n, len(verts), 'verts', len(tris), 'tris')
    (OUT / 'skin.json').write_text(json.dumps(out))


# 엉덩이 윤곽 (원본 좌표): 꼬리 뿌리 오른쪽 가장자리를 따라 위에서 아래로
RUMP = [(124, 124), (118, 134), (110, 146), (104, 158), (100, 170), (98, 182), (94, 192), (86, 199), (72, 206)]


def split_tail(meta, nat, K, out):
    p = meta['parts']['body']
    W, H = meta['canvas']
    full = np.zeros((H, W, 4), np.float32)
    im = np.asarray(Image.open(SRC / p['file']).convert('RGBA')).astype(np.float32)
    x, y = p['pos']
    full[y:y + im.shape[0], x:x + im.shape[1]] = im
    al = full[..., 3] / 255
    curve = SC.chaikin([nat(*q) for q in RUMP], it=3, closed=False)
    d_body = -SC.region(curve, [nat(*q) for q in [(-30, 206), (-30, -30), (124, -30)]], (H, W))   # 몸통 쪽 + (px)
    # 몸통: 엉덩이 윤곽 바깥(꼬리 쪽)은 털 가장자리로 끊음
    body_al = al * SC.fur_alpha(d_body, key=5)
    bb = SC.crop_save(full[..., :3], body_al, OUT / 'body.png', pad=4)
    p2 = dict(p)
    p2['pos'] = [bb[0], bb[1]]
    meta['parts']['body'] = p2
    # 꼬리: 윤곽 바깥 원본 + 몸통 안쪽 16px 띠(가려지는 꼬리 뿌리)를 LaMa 로 꼬리 털로 채움
    yy = np.arange(H)[:, None]
    inner = cv2.erode((al > 0.95).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    band = (d_body > -2) & (d_body < 16 * K) & (yy > nat(0, 136)[1]) & (yy < nat(0, 200)[1]) & inner
    rgbw = full[..., :3] * al[..., None] + 255 * (1 - al[..., None])
    ctx = rgbw.copy()
    ctx[d_body > 0] = 255
    fill = SC.inpaint(ctx, band)
    tail_al = np.where(d_body <= -2, al, 0.0)
    tail_al = np.maximum(tail_al, band.astype(np.float32))
    rgb = np.where(band[..., None], fill, full[..., :3])
    tb = SC.crop_save(rgb, tail_al, OUT / 'tail.png', pad=4)
    ta = np.asarray(Image.open(OUT / 'tail.png'))[..., 3]
    out['parts']['tail'] = SC.rigid_part('tail.png', -3, 'tail', ta, (tb[0], tb[1]))


if __name__ == '__main__':
    main()
