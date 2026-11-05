#!/usr/bin/env python3
"""
v3 파츠(art/pets/godot_src/ice_leopard_s1/parts_v3) → Godot 스키닝 메시 데이터.

각 파츠를 격자 메시로 덮고 정점마다 뼈 가중치를 계산한다.
- 몸통: body / head / tail 뼈. 머리·꼬리는 잘라 붙이지 않고 같은 이미지 안에서 휘어지게(이음새 없음).
- 다리: body / 해당 다리 뼈. 어깨·엉덩이 윗부분은 몸통에 고정(0), 발 쪽으로 갈수록 다리 뼈(1).
출력: godot/egg_island_pets/parts/ice_leopard_s1_v3/  (png 복사 + skin.json)
"""
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

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
        'tail': {'parent': 'body', 'pivot': nat(98, 168)},
    }
    out = {'origin': origin, 'k': K, 'off': off, 'ground_y': ground_y, 'bones': bones, 'parts': {}}
    FEET = {n: nat(*f) for n, f in {'leg_hind_near': (62, 275), 'leg_hind_far': (157, 276), 'leg_front_far': (202, 277),
                                     'leg_front_near': (322, 268)}.items()}
    out['feet'] = FEET
    for n, p in meta['parts'].items():
        shutil.copy(SRC / p['file'], OUT / p['file'])
        im = np.asarray(Image.open(SRC / p['file']))[..., 3]
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
            # 머리: 목에서 머리 쪽(위·앞)으로 / 꼬리: 엉덩이에서 꼬리 쪽(위·뒤)으로
            wh = axis_w(V[:, 0], V[:, 1], bones['head']['pivot'], (0.55, -0.83), -4 * K, 26 * K)
            wh *= smooth((V[:, 0] - nat(196, 0)[0]) / (14 * K))                      # 등 쪽으로 번지지 않게
            wt = axis_w(V[:, 0], V[:, 1], bones['tail']['pivot'], (-0.5, -0.87), -2 * K, 30 * K)
            wt *= smooth((nat(112, 0)[0] - V[:, 0]) / (14 * K))
            wt *= 1 - wh
            weights = {'head': wh, 'tail': wt, 'body': 1 - wh - wt}
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


if __name__ == '__main__':
    main()
