#!/usr/bin/env python3
"""
정면 원본 포즈(대기 앉은 포즈, 쓰다듬기 반응 포즈) → Godot 스키닝 메시.
원본 한 장을 자르지 않고 그대로 쓰고, 머리·꼬리·몸통(숨쉬기) 뼈 가중치만 계산한다 → 이음새 없음.
쓰다듬기 반응 포즈에 그려져 있던 하트는 따로 떼어 '떠오르는 하트' 스프라이트로, 효과선은 지운다.

출력: godot/egg_island_pets/parts/ice_leopard_s1_v3_idle/, ..._react/ (png + skin.json), react 폴더에 heart.png
"""
import json
from pathlib import Path

import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import skin_common as SC  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'art/pets/godot_src/ice_leopard_s1/hd'
OUTB = ROOT / 'godot/egg_island_pets/parts'
K = 2
G = 8
PAD = 40


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def mesh(alpha):
    h, w = alpha.shape
    nx, ny = w // G + 2, h // G + 2
    idx = -np.ones((ny, nx), int)
    verts, uvs, cells, tris = [], [], [], []
    for j in range(ny - 1):
        for i in range(nx - 1):
            blk = alpha[max(0, j * G - 2):min(h, j * G + G + 2), max(0, i * G - 2):min(w, i * G + G + 2)]
            if blk.size and blk.max() > 0:
                cells.append((i, j))
    for i, j in cells:
        for a, b in ((i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)):
            if idx[b, a] < 0:
                idx[b, a] = len(verts)
                u, v = min(a * G, w), min(b * G, h)
                uvs.append([u, v])
                verts.append([u, v])
    for i, j in cells:
        a, b, c, d = idx[j, i], idx[j, i + 1], idx[j + 1, i], idx[j + 1, i + 1]
        tris += [[int(a), int(b), int(d)], [int(a), int(d), int(c)]]
    return np.array(verts, float), uvs, tris


def build(name, src, head_curve, head_close, head_piv, neck_x, tail_curve, tail_close, tail_y, tail_piv, erase=(), heart_box=None):
    """head_curve: 머리 층을 떼는 턱·뺨 곡선(원본 px), neck_x: 머리 뒤 목을 채울 가로 범위.
    tail_curve: 꼬리 앞을 지나는 몸통 윤곽(원본 px, 위→아래), tail_close: 꼬리 쪽 영역을 닫는 점들."""
    out = OUTB / f'ice_leopard_s1_v3_{name}'
    out.mkdir(parents=True, exist_ok=True)
    a = np.asarray(Image.open(SRC / src).convert('RGBA')).astype(np.float32)
    meta = {}
    if heart_box:
        x0, y0, x1, y1 = [v * K for v in heart_box]
        heart = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8), 'RGBA')
        heart.save(out / 'heart.png')
        meta['heart'] = {'file': 'heart.png', 'center': [(x0 + x1) / 2 + PAD, (y0 + y1) / 2 + PAD], 'size': list(heart.size)}
        a[y0:y1, x0:x1, 3] = 0
    for (bx0, by0, bx1, by1) in erase:      # 귀 옆에 붙어 있는 효과선: 캐릭터 바깥 상자 영역을 통째로 지움
        a[by0 * K:by1 * K, bx0 * K:bx1 * K, 3] = 0
    if erase:
        # 지운 자리 주변에 남은 가는 선 조각은 열기(open) 연산으로 제거 — 귀 윤곽 같은 굵은 형태는 그대로 남음
        x0, y0 = min(e[0] for e in erase) * K - 12, min(e[1] for e in erase) * K - 12
        x1, y1 = max(e[2] for e in erase) * K + 12, max(e[3] for e in erase) * K + 12
        sub = a[y0:y1, x0:x1, 3]
        m = (sub > 20).astype(np.uint8)
        op = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        sub[(m > 0) & (op == 0)] = 0
    # 캐릭터와 떨어져 있는 조각(효과선 등)은 지운다: 가장 큰 덩어리(캐릭터)만 남김
    solid = (a[..., 3] > 20).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(cv2.dilate(solid, np.ones((3, 3), np.uint8)))
    if n > 2:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        a[..., 3][lab != keep] = 0
    a = np.pad(a, ((PAD, PAD), (PAD, PAD), (0, 0)))
    al = a[..., 3] / 255
    H, W = al.shape
    ground = float(np.where(al.max(1) > 0.25)[0].max())
    off = PAD / K
    nat = lambda x, y: [(x + off) * K, (y + off) * K]
    rgbw = a[..., :3] * al[..., None] + 255 * (1 - al[..., None])
    yy = np.arange(H)[:, None].astype(np.float32)
    xx = np.arange(W)[None, :].astype(np.float32)
    body_rgb = a[..., :3].copy()
    body_al = al.copy()
    parts = {}
    bones = {'body': {'parent': None, 'pivot': [W / 2, ground]}}
    # ── 꼬리: 몸통 왼쪽 윤곽(몸통이 꼬리 앞)을 따라 분리, 몸통 뒤로 숨는 꼬리 뿌리는 LaMa 로 이어 그림 ──
    if tail_curve:
        curve = SC.chaikin([nat(*q) for q in tail_curve], it=3, closed=False)
        d_body = -SC.region(curve, [nat(*q) for q in tail_close], (H, W))
        body_al = body_al * SC.fur_alpha(d_body, key=11)
        ty0, ty1 = nat(0, tail_y[0])[1], nat(0, tail_y[1])[1]
        # 꼬리 뿌리 띠는 몸통에 완전히 가려지는 곳(불투명한 몸통 안쪽)에만 → 몸통 밖으로 드러나지 않음
        inner = cv2.erode((al > 0.95).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        band = (d_body > -2) & (d_body < 18 * K) & (yy > ty0) & (yy < ty1) & inner
        ctx = rgbw.copy()
        ctx[d_body > -2] = 255
        fill = SC.inpaint(ctx, band)
        t_al = np.maximum(np.where(d_body <= -2, al, 0.0), band.astype(np.float32))
        t_rgb = np.where(band[..., None], fill, a[..., :3])
        bb = SC.crop_save(t_rgb, t_al, out / 'tail.png')
        parts['tail'] = SC.rigid_part('tail.png', -1, 'tail', np.asarray(Image.open(out / 'tail.png'))[..., 3], bb[:2])
        bones['tail'] = {'parent': 'body', 'pivot': nat(*tail_piv)}
    # ── 머리: 턱·뺨 윤곽 아래로 살짝 걸친 곡선으로 분리해 몸통 위에 얹음. 몸통의 목은 LaMa 로 채움 ──
    if head_curve:
        curve = SC.chaikin([nat(*q) for q in head_curve], it=3, closed=False)
        d_head = SC.region(curve, [nat(*q) for q in head_close], (H, W))   # 머리 쪽 +
        # 머리 층: 아래 가장자리는 몸통 털 위에 겹치는 부분이라 털결 가장자리로 부드럽게
        h_al = al * SC.fur_alpha(d_head / 3.0, amp=0.6, key=13)
        bb = SC.crop_save(a[..., :3], h_al, out / 'head.png')
        parts['head'] = SC.rigid_part('head.png', 2, 'head', np.asarray(Image.open(out / 'head.png'))[..., 3], bb[:2])
        bones['head'] = {'parent': 'body', 'pivot': nat(*head_piv)}
        # 몸통 층: 머리 영역을 지우고, 목(neck 타원 안, 곡선 위 22px 까지)만 털로 채워 남김
        nx0, nx1 = nat(neck_x[0], 0)[0], nat(neck_x[1], 0)[0]
        cx, rx = (nx0 + nx1) / 2, (nx1 - nx0) / 2
        neck = ((xx - cx) / rx) ** 2 < 1.0
        hole = (d_head > 1.5 * K)          # 곡선 바로 아래 몸통 픽셀은 원본 그대로 둔다(세로 절단면 방지)
        keep = hole & neck & (d_head < 22 * K) & (al > 0.5)   # 원래 그림이 있던 곳(머리 뒤)만 → 머리 밖으로 삐져나오지 않음
        ctx = rgbw.copy()
        ctx[hole] = 255
        fill = SC.inpaint(ctx, keep)
        body_rgb = np.where(keep[..., None], fill, body_rgb)
        top = SC.fur_alpha((22 * K - d_head) / 2.0, amp=0.8, key=17)     # 목 윗부분도 털 가장자리
        side = np.clip((1.0 - ((xx - cx) / rx) ** 2) * 6, 0, 1)
        body_al = np.where(hole, np.where(keep, top * side, 0.0), body_al)
    bb = SC.crop_save(body_rgb, body_al, out / 'body.png')
    parts['body'] = SC.rigid_part('body.png', 0, 'body', np.asarray(Image.open(out / 'body.png'))[..., 3], bb[:2])
    skin = {'origin': [W / 2, ground], 'k': K, 'off': off, 'ground_y': ground, 'bones': bones, 'parts': parts}
    if 'head' not in bones:
        bones['head'] = {'parent': 'body', 'pivot': [W / 2, ground]}
    skin.update(meta)
    (out / 'skin.json').write_text(json.dumps(skin))
    print(name, {k: len(v['verts']) for k, v in parts.items()}, 'ground', ground)


def main():
    SC.LAMA_PATH = os.environ.get('LAMA', '/tmp/claude-0/-home-claude/748eeeb8-c914-548e-b7f0-96237bd15e7c/scratchpad/models/big-lama.pt')
    # 대기: 정면 앉은 포즈. 머리는 턱·뺨 윤곽으로 떼어 단단히 갸웃, 꼬리는 몸통 왼쪽 윤곽 뒤에서 살랑
    build('idle', 'pose_idle.webp',
          head_curve=[(10, 140), (40, 152), (58, 169), (72, 181), (88, 187), (104, 189), (122, 190), (150, 191), (178, 190),
                      (196, 189), (212, 187), (228, 181), (242, 169), (260, 152), (290, 140)],
          head_close=[(300, 140), (300, -40), (0, -40), (0, 140)],
          head_piv=(150, 184), neck_x=(78, 224),
          tail_curve=[(80, 190), (77, 204), (74, 218), (72, 232), (70, 252), (71, 272), (74, 292), (80, 312), (90, 330)],
          tail_close=[(90, 345), (-30, 345), (-30, 184), (80, 184)], tail_y=(180, 320), tail_piv=(84, 292))
    # 쓰다듬기 반응: 고개를 든 채 손에 비비는 포즈 — 머리와 목털이 이어져 있어 머리는 떼지 않고 몸 전체를 흔든다.
    # 꼬리만 떼어 살랑. 하트는 떼어 내 떠오르게, 귀 옆 효과선은 지움
    build('react', 'pose_pet_react.webp', head_curve=None, head_close=None, head_piv=(170, 168), neck_x=None,
          tail_curve=[(102, 170), (96, 180), (90, 192), (83, 210), (80, 230), (80, 250), (83, 268), (90, 284)],
          tail_close=[(90, 300), (-30, 300), (-30, 163), (102, 163)], tail_y=(156, 290), tail_piv=(88, 262),
          erase=[(48, 104, 67, 152), (58, 96, 70, 112)], heart_box=(172, 0, 234, 46))


if __name__ == '__main__':
    main()
