#!/usr/bin/env python3
"""
설표(ice_leopard) 1단계 — 기존 원본 포즈 이미지를 파츠로 분리 (새 캐릭터 생성 없음).

입력 (art/pets/godot_src/ice_leopard_s1/hd/): Figma 원본 시트에서 잘라 배경 제거 후 Real-ESRGAN ×2 한 포즈
  pose_walk  — 옆모습 걷기 키포즈 → 머리·몸통·꼬리·다리 4개로 분리 (걷기·달리기 리그)
  pose_idle  — 정면 앉은 키포즈 → 머리·몸통·꼬리 (대기 리그)
  pose_pet_react — 쓰다듬기 반응 키포즈 → 머리·몸통 (반응 리그, 그려진 하트·효과선은 지움)
  pose_cl_* — 근접 교감 전용 4장 (그대로 사용)
출력: godot/egg_island_pets/parts/ice_leopard_s1/*.png + rig.json (파츠 좌상단·피벗, 리그 좌표 = HD px)

좌표는 원본(native) 픽셀로 적고 ×2 해서 쓴다. 파츠 경계는 페더(부드러운 알파)로 이어 붙여 관절 틈을 숨긴다.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'art/pets/godot_src/ice_leopard_s1/hd'
OUT = ROOT / 'godot/egg_island_pets/parts/ice_leopard_s1'
K = 2  # native → HD


def poly_mask(size, pts, feather=0, grow=0):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([(x * K, y * K) for x, y in pts], fill=255)
    if grow:
        m = m.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(m).astype(np.float32) / 255


def apply(img, mask):
    a = np.asarray(img).astype(np.float32)
    a[..., 3] *= mask
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def save_part(name, img, pivot_native, z, parent='body'):
    bb = img.getbbox()
    crop = img.crop(bb)
    crop.save(OUT / f'{name}.png')
    return {'name': name, 'file': f'{name}.png', 'pos': [bb[0], bb[1]], 'size': [crop.width, crop.height],
            'pivot': [pivot_native[0] * K, pivot_native[1] * K], 'z': z, 'parent': parent}


BELLY = [(0, 218), (40, 214), (75, 206), (115, 203), (150, 211), (200, 209), (236, 203), (290, 199), (330, 210), (368, 226)]


def rig_walk():
    """배 아래 매끈한 곡선(BELLY)을 경계로 다리를 분리. 다리는 곡선 위로 18px 겹치게(부드러운 그라데이션) 잘라
    회전해도 관절에 틈·톱니가 보이지 않게 한다. 몸통은 곡선 아래만 2px 페더로 지운다."""
    base = Image.open(SRC / 'pose_walk.webp').convert('RGBA')
    S = base.size
    W, H = S
    xs = np.arange(W) / K
    cy = np.interp(xs, [p[0] for p in BELLY], [p[1] for p in BELLY]) * K
    yy = np.arange(H)[:, None].astype(np.float32)
    d = yy - cy[None, :]                       # + : 곡선 아래
    ext = 12 * K
    below = np.clip(d / (2 * K) + 0.5, 0, 1)   # 몸통 제거용 (2px 페더)
    leg_v = np.clip((d + ext) / ext, 0, 1)     # 다리: 곡선 위 ext 까지 서서히
    # 다리 사이 경계: 원본에서 다리 사이로 배경이 보이는 틈을 따라 비스듬히 자른다 (세로 직선 절단 금지)
    bands = {
        'leg_hind_near': ([(0, 150), (126, 150), (130, 214), (124, 246), (120, 300), (0, 300)], (104, 206), 6),
        'leg_hind_far': ([(126, 150), (178, 150), (176, 214), (174, 248), (176, 300), (120, 300), (124, 246), (130, 214)], (148, 210), -2),
        'leg_front_far': ([(178, 150), (234, 150), (234, 204), (242, 232), (236, 300), (176, 300), (174, 248), (176, 214)], (204, 208), -2),
        'leg_front_near': ([(234, 150), (368, 150), (368, 300), (290, 300), (284, 274), (250, 246), (242, 232), (234, 204)], (250, 203), 6),
    }
    parts = []
    for name, (poly, piv, z) in bands.items():
        hx = poly_mask(S, poly, feather=5)
        xx = np.arange(W)[None, :].astype(np.float32) / K
        # 겹침(곡선 위) 부분은 다리 윗부분 폭만큼만 → 회전해도 몸통 바깥으로 뾰족하게 튀어나오지 않음
        top = {'leg_hind_near': (74, 124), 'leg_front_near': (240, 296)}.get(name)
        if z > 0 and top:
            tx = np.clip((xx - top[0]) / 6 + 0.5, 0, 1) * np.clip((top[1] - xx) / 6 + 0.5, 0, 1)
            lv = np.where(d >= 0, 1.0, leg_v * tx)
        else:
            lv = np.clip((d + 3 * K) / (3 * K), 0, 1)
        parts.append(save_part('walk_' + name, apply(base, lv * hx), piv, z))
        parts[-1]['name'] = name
    body = apply(base, 1 - below)
    tail_poly = [(4, 30), (112, 26), (130, 118), (120, 160), (96, 176), (70, 192), (44, 214), (4, 214)]
    head_poly = [(196, 8), (368, 8), (368, 168), (300, 172), (246, 160), (210, 128), (196, 70)]
    parts.append(save_part('walk_tail', apply(base, poly_mask(S, tail_poly, feather=3)), (114, 158), -1)); parts[-1]['name'] = 'tail'
    body = apply(body, 1 - poly_mask(S, tail_poly, feather=1.5))
    parts.append(save_part('walk_head', apply(base, poly_mask(S, head_poly, feather=7)), (246, 150), 8)); parts[-1]['name'] = 'head'
    bb = body.getbbox()
    body.crop(bb).save(OUT / 'walk_body.png')
    parts.insert(0, {'name': 'body', 'file': 'walk_body.png', 'pos': [bb[0], bb[1]], 'size': [bb[2] - bb[0], bb[3] - bb[1]],
                     'pivot': [180 * K, 190 * K], 'z': 0, 'parent': None})
    return {'canvas': list(S), 'ground_y': 280 * K, 'parts': parts}


def rig_simple(src, prefix, head_poly, head_piv, tail_poly=None, tail_piv=None, erase=()):
    base = Image.open(SRC / src).convert('RGBA')
    S = base.size
    for pts in erase:  # 원본에 그려진 하트·효과선 제거 (캐릭터 픽셀은 건드리지 않음)
        base = apply(base, 1 - poly_mask(S, pts))
    parts = []
    body = base
    if tail_poly:
        parts.append(save_part(f'{prefix}_tail', apply(base, poly_mask(S, tail_poly, feather=3)), tail_piv, -1))
        body = apply(body, 1 - poly_mask(S, tail_poly, feather=1.5))
    parts.append(save_part(f'{prefix}_head', apply(base, poly_mask(S, head_poly, feather=8)), head_piv, 8))
    bb = body.getbbox()
    body.crop(bb).save(OUT / f'{prefix}_body.png')
    a = np.asarray(base)[..., 3]
    ground = int(np.where(a.max(axis=1) > 60)[0].max())
    parts.insert(0, {'name': 'body', 'file': f'{prefix}_body.png', 'pos': [bb[0], bb[1]], 'size': [bb[2] - bb[0], bb[3] - bb[1]],
                     'pivot': [S[0] // 2, ground], 'z': 0, 'parent': None})
    for p in parts:
        p['file'] = f"{p['name']}.png" if p['name'] != 'body' else p['file']
        p['name'] = p['name'].replace(f'{prefix}_', '')
    return {'canvas': list(S), 'ground_y': ground, 'parts': parts}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rig = {'pet': 'PET_SNOW_C', 'slug': 'ice_leopard', 'stage': 1, 'source': 'Figma Lv3HWAQS9cBVqu5zQbinCy 원본 포즈 (재생성 없음)'}
    rig['walk'] = rig_walk()
    # 정면 앉은 포즈 (HD 548×670 ≈ native 274×335)
    rig['idle'] = rig_simple('pose_idle.webp', 'idle',
                             head_poly=[(30, 8), (262, 8), (262, 172), (200, 186), (137, 190), (74, 186), (30, 160)], head_piv=(137, 180),
                             tail_poly=[(4, 180), (64, 176), (70, 230), (66, 296), (56, 330), (4, 330)], tail_piv=(70, 290))
    rig['pet_react'] = rig_simple('pose_pet_react.webp', 'react',
                                  head_poly=[(60, 30), (262, 30), (262, 170), (200, 182), (130, 176), (60, 150)], head_piv=(170, 170),
                                  erase=[[(175, 0), (232, 0), (232, 43), (175, 43)],          # 하트
                                         [(84, 40), (134, 40), (134, 86), (84, 86)],  # 효과선(위)
                                         [(36, 100), (62, 100), (62, 152), (36, 152)]])          # 효과선(왼쪽)
    for n in ['cl_notice_approach', 'cl_closeup', 'cl_rub_cheek', 'cl_gaze_back_off']:
        im = Image.open(SRC / f'pose_{n}.webp').convert('RGBA')
        if n in ('cl_closeup', 'cl_rub_cheek'):
            # 화면을 꽉 채운 원본 클로즈업: 배경 제거 대신(흰 털이 같이 지워짐) 둥근 타원으로 가장자리를 부드럽게 감싼다
            arr = np.asarray(im).astype(np.float32)
            h, w = arr.shape[:2]
            yy2, xx2 = np.mgrid[0:h, 0:w]
            r = np.sqrt(((xx2 - w / 2) / (w * 0.5)) ** 2 + ((yy2 - h / 2) / (h * 0.5)) ** 2)
            arr[..., 3] = 255 * np.clip((1.0 - r) / 0.16, 0, 1)
            im = Image.fromarray(arr.astype(np.uint8), 'RGBA')
        im.save(OUT / f'{n}.png')
        rig.setdefault('closeup', {})[n] = {'file': f'{n}.png', 'size': list(im.size)}
    (OUT / 'rig.json').write_text(json.dumps(rig, ensure_ascii=False, indent=1))
    print('ok', len(rig['walk']['parts']), 'walk parts')


if __name__ == '__main__':
    main()
