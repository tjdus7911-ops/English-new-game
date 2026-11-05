#!/usr/bin/env python3
"""
설표(ice_leopard) 1단계 파츠 v2 — 원본 포즈에서 파츠를 자동 분리하고, 원본에 그려져 있지 않은 부위
(배 아랫면, 머리 밑 목, 다른 다리에 가려진 다리 부분)를 로컬 인페인팅(LaMa)으로 채운다.

- 캐릭터를 새로 생성하지 않는다: 얼굴·눈·무늬·비율은 원본 픽셀 그대로. AI 는 '가려져 안 보이던 털'만 채운다.
- 입력: art/pets/godot_src/ice_leopard_s1/hd/pose_*.webp (Figma 원본 → 배경 제거 → Real-ESRGAN ×2)
- 출력: godot/egg_island_pets/parts/ice_leopard_s1_v2/*.png + rig.json  (v1 폴더는 비교용으로 그대로 둔다)
- 모델: big-lama.pt (Apache-2.0, GitHub Sanster/models 릴리스) — CPU 로 파츠당 수 초.

사용: python3 prepare_parts_v2.py --lama /path/big-lama.pt
좌표는 원본(native) 픽셀로 적고 ×2(K) 해서 쓴다.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import cv2
import torch
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'art/pets/godot_src/ice_leopard_s1/hd'
OUT = ROOT / 'godot/egg_island_pets/parts/ice_leopard_s1_v2'
DBG = OUT / '_debug'
K = 2
LAMA = None


# ───────────────────────── 공통 ─────────────────────────
def inpaint(rgb, mask):
    """rgb float/uint8 HxWx3, mask bool HxW → uint8. 마스크 안만 바뀐다."""
    rgb = np.asarray(rgb).clip(0, 255).astype(np.uint8)
    H, W = mask.shape
    ph, pw = (8 - H % 8) % 8, (8 - W % 8) % 8
    im = np.pad(rgb, ((0, ph), (0, pw), (0, 0)), mode='edge')
    m = np.pad(mask, ((0, ph), (0, pw)))
    t = torch.from_numpy(im).permute(2, 0, 1)[None].float() / 255
    mt = torch.from_numpy(m)[None, None].float()
    with torch.no_grad():
        o = LAMA(t, mt)[0].permute(1, 2, 0).numpy()
    o = np.clip(o * 255, 0, 255).astype(np.uint8)[:H, :W]
    return np.where(mask[..., None], o, rgb)


def poly(size, pts, feather=0.0, grow=0):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([(x * K, y * K) for x, y in pts], fill=255)
    if grow:
        m = m.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather * K))
    return np.asarray(m).astype(np.float32) / 255


def rounded(m, r):
    """윤곽 모서리를 둥글게 (열기→닫기, r: 원본 px)."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r * K + 1, 2 * r * K + 1))
    b = (m > 0.5).astype(np.uint8)
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, k)
    return b.astype(np.float32)


def edge_shade(alpha, width, strength):
    """가장자리 안쪽을 살짝 어둡게 → 잘린 면이 아닌 둥근 다리처럼 보이게."""
    d = cv2.distanceTransform((alpha > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    return 1 - strength * (1 - np.clip(d / (width * K), 0, 1)) ** 2


def ellipse(size, c, r, feather=0.0):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).ellipse([(c[0] - r[0]) * K, (c[1] - r[1]) * K, (c[0] + r[0]) * K, (c[1] + r[1]) * K], fill=255)
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather * K))
    return np.asarray(m).astype(np.float32) / 255


def load(name):
    a = np.asarray(Image.open(SRC / name).convert('RGBA')).astype(np.float32)
    al = a[..., 3] / 255
    rgb_white = a[..., :3] * al[..., None] + 255 * (1 - al[..., None])   # 인페인팅 문맥용 (배경 흰색)
    return a, al, rgb_white


def rgba(rgb, alpha):
    return Image.fromarray(np.dstack([np.asarray(rgb).clip(0, 255), (np.asarray(alpha) * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')


def unpremul(rgb_white, al):
    """흰 배경에 합성된 색을 반투명 가장자리에서 원래 색으로 되돌린다 (흰 테두리 방지)."""
    a = np.maximum(al, 1e-3)[..., None]
    return np.where(al[..., None] > 0.02, (rgb_white - 255 * (1 - a)) / a, rgb_white)


def save_part(name, img, pivot, z, parent='body'):
    bb = img.getbbox()
    img.crop(bb).save(OUT / f'{name}.png')
    return {'name': name, 'file': f'{name}.png', 'pos': [bb[0], bb[1]], 'size': [bb[2] - bb[0], bb[3] - bb[1]],
            'pivot': [pivot[0] * K, pivot[1] * K], 'z': z, 'parent': parent}


def head_and_body(a, al, rgbw, head_poly, stump, head_feather, fill_stump=True):
    """머리 파츠(아랫부분만 부드럽게) + 머리를 지운 몸통 (rgb, alpha).
    목 밑동(stump): fill_stump=False 면 원본 목털 그대로, True 면 턱·입이 겹치는 자리라 인페인팅으로 털만 채움."""
    S = (a.shape[1], a.shape[0])
    head = rgba(a[..., :3], al * poly(S, head_poly, feather=head_feather))
    hp = poly(S, head_poly) > 0.5
    st = stump > 0.5
    body_al = al.copy()
    body_rgb = a[..., :3].copy()
    body_al[hp & ~st] = 0
    if fill_stump:
        m = hp & (stump > 0.02)                     # 부드러운 가장자리까지 전부 채워 코·입 조각이 남지 않게
        ctx = rgbw.copy()
        filled = inpaint(ctx, m)                   # 주변(가슴·뺨 털)을 문맥으로 목 털을 채움
        body_rgb = np.where(m[..., None], filled, body_rgb)
        body_al = np.where(m, np.maximum(stump, body_al), body_al)
    else:
        body_al = np.where(hp & st, al * stump, body_al)
    return head, body_rgb.astype(np.float32), body_al


# ───────────────────────── 걷기·달리기 리그 ─────────────────────────
BELLY = [(0, 218), (40, 214), (75, 206), (115, 203), (150, 211), (200, 209), (236, 203), (290, 199), (330, 210), (368, 226)]
LEGS = {
    #            다리 윤곽(원본 좌표)                                                                  피벗        z   앞쪽?
    'leg_hind_near': ([(58, 176), (136, 176), (139, 206), (135, 238), (110, 243), (86, 241), (82, 276), (34, 276), (35, 242), (46, 206)], (108, 200), 6, True),
    'leg_hind_far': ([(130, 186), (180, 186), (180, 240), (178, 277), (134, 277), (130, 240)], (157, 208), -2, False),
    'leg_front_far': ([(172, 186), (238, 186), (240, 244), (230, 279), (174, 279), (172, 240)], (204, 208), -2, False),
    'leg_front_near': ([(224, 178), (286, 178), (312, 214), (346, 232), (346, 276), (294, 276), (262, 254), (238, 234), (228, 212)], (252, 200), 6, True),
}


def rig_walk():
    a, al, rgbw = load('pose_walk.webp')
    H, W = al.shape
    S = (W, H)
    xs = np.arange(W) / K
    yy = np.arange(H)[:, None].astype(np.float32)
    cy = np.interp(xs, [p[0] for p in BELLY], [p[1] for p in BELLY]) * K
    u = np.clip((xs - 60) / (330 - 60), 0, 1)
    cy2 = cy + 11 * K * np.sin(np.pi * u) ** 0.7          # 새 배 아랫선 (둥글게 14px)
    below = yy >= cy[None, :]
    parts = []

    # 다리 ─ 앞쪽 다리는 몸통 위, 윗부분을 몸통 털로 부드럽게 녹인다 / 뒤쪽 다리는 몸통 뒤, 가려진 곳은 인페인팅
    near_union = np.zeros((H, W), bool)
    for n, (pts, piv, z, near) in LEGS.items():
        if near:
            near_union |= poly(S, pts) > 0.5
    for n, (pts, piv, z, near) in LEGS.items():
        pm = poly(S, pts, feather=1.5)
        if near:
            pm = poly(S, pts, feather=4)                     # 몸통 털 위에 놓이는 옆 절단면을 넓게 녹임
            fade = np.clip((yy - (cy[None, :] - 12 * K)) / (12 * K), 0, 1)   # 배 선 12px 위에서부터 서서히
            m = pm * fade
            img = rgba(a[..., :3], al * m)
        else:
            inside = poly(S, pts) > 0.5
            occl = inside & near_union & (yy >= cy[None, :] - 6 * K)    # 앞다리에 가려진 부분
            fill = inpaint(rgbw, occl)                                  # 주변 털(원본)을 문맥으로 채움
            ground = int(np.where(al.max(1) > 0.5)[0].max())
            shape = np.where(occl, (yy < ground - 2 * K).astype(np.float32), (al > 0.5).astype(np.float32)) * inside
            shape = rounded(shape, 7)                                   # 각진 절단면 → 둥근 다리 윤곽
            shape = cv2.GaussianBlur(shape, (0, 0), 1.2 * K)
            leg_al = np.minimum(shape, np.where(occl, 1.0, al))
            leg_al *= np.clip((yy - (cy[None, :] - 8 * K)) / (2 * K), 0, 1)   # 윗부분은 몸통 배에 가려짐
            rgb = np.where(occl[..., None], fill, a[..., :3]) * edge_shade(leg_al, 7, 0.28)[..., None]
            img = rgba(rgb, leg_al)
        parts.append(save_part('walk_' + n, img, piv, z))
        parts[-1]['name'] = n

    # 머리 + 목 밑동
    head_poly = [(188, 0), (372, 0), (372, 176), (300, 174), (244, 152), (212, 112), (184, 70)]
    stump = poly(S, [(184, 70), (212, 74), (240, 104), (276, 140), (312, 160), (330, 176), (244, 160), (210, 126)], feather=2)
    head, body_rgb, body_al = head_and_body(a, al, rgbw, head_poly, stump, head_feather=3.5, fill_stump=False)
    parts.append(save_part('walk_head', head, (240, 140), 8)); parts[-1]['name'] = 'head'

    # 배 아랫면: 다리를 지우고(흰 문맥) 배 띠를 인페인팅
    ctx = body_rgb * body_al[..., None] + 255 * (1 - body_al[..., None])
    ctx[below] = 255
    band = (yy >= cy[None, :] - 4 * K) & (yy <= cy2[None, :] + 3 * K) & (xs[None, :] > 56) & (xs[None, :] < 334)
    filled = inpaint(ctx, band)
    t = np.clip((yy - cy[None, :]) / np.maximum(cy2 - cy, 1)[None, :], 0, 1)
    shade = 1 - 0.30 * t ** 1.2                                  # 아랫면으로 갈수록 살짝 그늘
    belly_al = np.clip((cy2[None, :] - yy) / (3.5 * K), 0, 1) * (yy >= cy[None, :] - 4 * K) * (xs[None, :] > 58) * (xs[None, :] < 332)
    # 배 띠는 원래 몸통이 있던 x 범위에서만 (배 선 바로 위가 털)
    rowc = np.clip(cy.astype(int) - 4 * K, 0, H - 1)
    has = body_al[rowc, np.arange(W)] > 0.5
    belly_al *= has[None, :]
    body_rgb = np.where(band[..., None], filled * shade[..., None], body_rgb)
    body_al = np.where(below, belly_al, np.maximum(body_al, belly_al * (yy >= cy[None, :] - 4 * K)))

    # 꼬리: 몸통 뒤 (몸통 안쪽까지 넉넉히)
    tail_cut = [(4, 30), (112, 26), (128, 118), (116, 160), (92, 176), (68, 192), (44, 214), (4, 214)]
    tail_part = [(4, 30), (112, 26), (134, 118), (146, 160), (136, 192), (104, 208), (60, 216), (4, 216)]
    parts.append(save_part('walk_tail', rgba(a[..., :3], al * poly(S, tail_part, feather=1)), (116, 158), -1)); parts[-1]['name'] = 'tail'
    body_al = body_al * (1 - poly(S, tail_cut, feather=0.75))

    body = rgba(body_rgb, body_al)
    bb = body.getbbox()
    body.crop(bb).save(OUT / 'walk_body.png')
    parts.insert(0, {'name': 'body', 'file': 'walk_body.png', 'pos': [bb[0], bb[1]], 'size': [bb[2] - bb[0], bb[3] - bb[1]],
                     'pivot': [180 * K, 190 * K], 'z': 0, 'parent': None})
    return {'canvas': list(S), 'ground_y': 280 * K, 'parts': parts}


# ───────────────────────── 대기·쓰다듬기 리그 (정면 앉은 포즈) ─────────────────────────
def rig_front(src, prefix, head_poly, head_piv, stump, tail_poly=None, tail_part=None, tail_piv=None, erase=()):
    a, al, rgbw = load(src)
    H, W = al.shape
    S = (W, H)
    for pts, dark_only in erase:          # 원본에 그려진 하트·효과선 제거 (dark_only: 상자 안의 검은 선만)
        m = poly(S, pts) > 0.5
        if dark_only:
            luma = a[..., :3].mean(-1)
            m &= cv2.dilate(((luma < 120) & (al > 0.1)).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        al = np.where(m, 0, al)
        rgbw[m] = 255
    parts = []
    st = ellipse(S, stump[0], stump[1], feather=2)
    head, body_rgb, body_al = head_and_body(a, al, rgbw, head_poly, st, head_feather=4)
    parts.append(save_part(f'{prefix}_head', head, head_piv, 8)); parts[-1]['name'] = 'head'
    if tail_poly:
        parts.append(save_part(f'{prefix}_tail', rgba(a[..., :3], al * poly(S, tail_part, feather=1)), tail_piv, -1)); parts[-1]['name'] = 'tail'
        body_al = body_al * (1 - poly(S, tail_poly, feather=0.75))
    body = rgba(body_rgb, body_al)
    bb = body.getbbox()
    body.crop(bb).save(OUT / f'{prefix}_body.png')
    ground = int(np.where(al.max(axis=1) > 0.25)[0].max())
    parts.insert(0, {'name': 'body', 'file': f'{prefix}_body.png', 'pos': [bb[0], bb[1]], 'size': [bb[2] - bb[0], bb[3] - bb[1]],
                     'pivot': [W // 2, ground], 'z': 0, 'parent': None})
    return {'canvas': list(S), 'ground_y': ground, 'parts': parts}


def debug_sheet(rig):
    """파츠를 떼어 놓은 분해도 (검수용)."""
    DBG.mkdir(exist_ok=True)
    for key in ('walk', 'idle', 'pet_react'):
        r = rig[key]
        imgs = [(p, Image.open(OUT / p['file'])) for p in r['parts']]
        pad = 24
        Wt = sum(i.width for _, i in imgs) + pad * (len(imgs) + 1)
        Ht = max(i.height for _, i in imgs) + pad * 2
        sheet = Image.new('RGBA', (Wt, Ht), (220, 230, 242, 255))
        x = pad
        for p, i in imgs:
            sheet.alpha_composite(i, (x, pad)); x += i.width + pad
        sheet.save(DBG / f'{key}_parts.png')


def main():
    global LAMA
    ap = argparse.ArgumentParser()
    ap.add_argument('--lama', required=True)
    args = ap.parse_args()
    LAMA = torch.jit.load(args.lama, map_location='cpu').eval()
    OUT.mkdir(parents=True, exist_ok=True)
    rig = {'pet': 'PET_SNOW_C', 'slug': 'ice_leopard', 'stage': 1, 'version': 2,
           'source': 'Figma Lv3HWAQS9cBVqu5zQbinCy 원본 포즈. 가려진 털만 LaMa 인페인팅으로 보완 (캐릭터 재생성 없음)'}
    rig['walk'] = rig_walk()
    rig['idle'] = rig_front('pose_idle.webp', 'idle',
                            head_poly=[(28, 4), (266, 4), (266, 166), (214, 178), (176, 188), (137, 192), (98, 188), (60, 178), (28, 160)],
                            head_piv=(137, 182), stump=((137, 172), (64, 26)),
                            tail_poly=[(4, 180), (60, 176), (72, 230), (76, 296), (66, 334), (4, 334)],
                            tail_part=[(4, 176), (70, 172), (94, 230), (92, 286), (80, 334), (4, 334)], tail_piv=(78, 292))
    rig['pet_react'] = rig_front('pose_pet_react.webp', 'react',
                                 head_poly=[(48, 28), (264, 28), (264, 168), (226, 176), (190, 170), (150, 168), (110, 160), (70, 150), (48, 130)],
                                 head_piv=(170, 166), stump=((168, 160), (62, 24)),
                                 erase=[([(175, 0), (232, 0), (232, 43), (175, 43)], False),
                                        ([(76, 40), (132, 40), (132, 92), (76, 92)], True),
                                        ([(38, 92), (68, 92), (68, 162), (38, 162)], True)])
    for n in ['cl_notice_approach', 'cl_closeup', 'cl_rub_cheek', 'cl_gaze_back_off']:
        im = Image.open(SRC / f'pose_{n}.webp').convert('RGBA')
        if n in ('cl_closeup', 'cl_rub_cheek'):
            arr = np.asarray(im).astype(np.float32)
            h, w = arr.shape[:2]
            yy2, xx2 = np.mgrid[0:h, 0:w]
            r = np.sqrt(((xx2 - w / 2) / (w * 0.5)) ** 2 + ((yy2 - h / 2) / (h * 0.5)) ** 2)
            arr[..., 3] = 255 * np.clip((1.0 - r) / 0.16, 0, 1)
            im = Image.fromarray(arr.astype(np.uint8), 'RGBA')
        im.save(OUT / f'{n}.png')
        rig.setdefault('closeup', {})[n] = {'file': f'{n}.png', 'size': list(im.size)}
    (OUT / 'rig.json').write_text(json.dumps(rig, ensure_ascii=False, indent=1))
    debug_sheet(rig)
    print('ok', {k: len(rig[k]['parts']) for k in ('walk', 'idle', 'pet_react')})


if __name__ == '__main__':
    main()
