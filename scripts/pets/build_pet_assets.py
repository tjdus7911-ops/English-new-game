#!/usr/bin/env python3
"""
EGG ISLAND 펫 에셋 빌드 — Figma 원본 시트(art/pets/source/*.webp) → 게임용 아틀라스 + 메타데이터.

원본 (Figma 파일 Lv3HWAQS9cBVqu5zQbinCy 의 모션 시트를 펫별로 3×3 타일로 모아 내보낸 것):
  {slug}.webp        4608×2592 원본을 3072×1728 로 내보냄. 타일 1024×576.
                     행 = 성장 단계(S1·S2·S3), 열 = basic · emotion · interaction 시트
  fire_fox_extra.webp  불꽃 여우 전용: 근접 교감(S2·S3·S1) · S2→S3 진화 키프레임 · 턴어라운드(S1~S3)
  eggs.webp          속성 공통 알 9종 (3×3, 864px 칸)
  icons.webp         불꽃 여우 감정 아이콘 9종 (3×3)
  lineups_{0,1,2}.webp 펫별 성장 라인업(S1~S3 나란히) 3×3, 펫 순서는 PET_ORDER

출력:
  public/assets/pets/{slug}/s{n}.webp      성장 단계별 아틀라스 (배경 제거·여백 정리된 키포즈)
  public/assets/pets/{slug}/lineup.webp    도감용 성장 라인업
  public/assets/pets/eggs/{attr}.webp      알
  public/assets/pets/fire_fox/extra/*.webp 불꽃 여우 전용 (턴어라운드·진화 연출·감정 아이콘)
  src/pets/generated/atlas.json            프레임 좌표·기준점(발밑)·불투명 여부

사용:  python3 scripts/pets/build_pet_assets.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art/pets/source'
OUT = ROOT / 'public/assets/pets'
META = ROOT / 'src/pets/generated/atlas.json'

PET_ORDER = [
    'fire_fox', 'flame_lizard', 'ember_cat', 'aqua_bunny', 'coral_otter', 'wave_dragon',
    'sprout_deer', 'moss_guardian', 'petal_fox', 'volt_squirrel', 'spark_chick', 'spark_puppy',
    'crescent_cat', 'starry_bat', 'dream_bunny', 'candy_deer', 'heart_hamster', 'ribbon_puppy',
    'snow_fox', 'frost_penguin', 'ice_leopard', 'sun_lion', 'golden_phoenix', 'light_giraffe',
    'shadow_fox', 'dusk_wolf', 'night_dragon',
]
ATTRS = ['fire', 'water', 'forest', 'lightning', 'moon', 'love', 'snow', 'sun', 'night']

TILE_W, TILE_H = 1024, 576
BASIC = [['idle', 'walk', 'run', 'sit', 'sleep'], ['wake_up', 'jump', 'turn', 'look_around', 'eat']]
EMOTION = [['emo_happy', 'emo_sad', 'emo_love', 'emo_yawn', 'emo_tilt'], ['emo_surprise', 'emo_excited', 'emo_angry', 'emo_curious', 'emo_shy']]
INTERACTION = [
    ['it_pet_react', 'it_feed_run', 'it_toy_play', 'it_follow_light'],
    ['it_drowsy_rest', 'it_celebrate_correct', 'it_cheer_wrong', 'unique_01'],
    ['cl_notice_approach', 'cl_closeup', 'cl_rub_cheek', 'cl_gaze_back_off'],
]
# 불꽃 여우 시트는 상호작용이 4×2 (근접 교감은 별도 시트). 이름은 공통 규격으로 맞추고 원래 이름은 source 로 남긴다
FOX_INTERACTION = [
    ['it_pet_react', 'it_feed_run', 'it_toy_play', ('it_follow_light', 'it_follow_finger')],
    ['it_drowsy_rest', 'it_celebrate_correct', 'it_cheer_wrong', ('unique_01', 'it_flame_spin')],
]
NUZZLE = [['cl_notice_approach', 'cl_closeup', 'cl_rub_cheek', 'cl_gaze_back_off']]
# 화면을 꽉 채우는 클로즈업 — 배경 제거 없이 사각형 그대로 (둥근 프레임 안에 표시)
OPAQUE = {'cl_closeup', 'cl_rub_cheek'}


def tile(img: Image.Image, col: int, row: int) -> Image.Image:
    return img.crop((col * TILE_W, row * TILE_H, (col + 1) * TILE_W, (row + 1) * TILE_H))


def cells(t: Image.Image, grid):
    rows = len(grid)
    cols = len(grid[0])
    w, h = t.width / cols, t.height / rows
    for r, line in enumerate(grid):
        for c, name in enumerate(line):
            box = (round(c * w), round(r * h), round((c + 1) * w), round((r + 1) * h))
            src = None
            if isinstance(name, tuple):
                name, src = name
            yield name, src, t.crop(box)


_SESSION = None


def remove_bg(im: Image.Image, inset: int = 3) -> Image.Image:
    """흰 배경 제거 — 세그멘테이션 모델(rembg isnet-general-use)로 마스크를 만든 뒤,
    가장자리 흰 번짐을 걷어낸다. 흰 털 펫(눈꽃 여우 등)의 몸이 지워지지 않도록 색 임계값 방식 대신 사용."""
    global _SESSION
    from rembg import new_session, remove
    if _SESSION is None:
        _SESSION = new_session('isnet-general-use')
    rgb = im.convert('RGB').crop((inset, inset, im.width - inset, im.height - inset))
    # 모델 입력 여백 (가장자리에 붙은 몸이 잘리지 않게)
    padded = Image.new('RGB', (rgb.width + 24, rgb.height + 24), (255, 255, 255))
    padded.paste(rgb, (12, 12))
    mask = np.asarray(remove(padded, session=_SESSION, only_mask=True))[12:-12, 12:-12].astype(np.float32)
    a = np.asarray(rgb).astype(np.float32)
    alpha = np.clip((mask - 20) * (255.0 / 215.0), 0, 255)
    af = (alpha / 255.0)[..., None]
    # 반투명 경계의 흰 배경 섞임 제거 (un-premultiply against white)
    out_rgb = np.where(af > 0.02, (a - (1 - af) * 255.0) / np.maximum(af, 1e-3), a)
    out = np.dstack([np.clip(out_rgb, 0, 255), alpha]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im: Image.Image, pad: int = 2):
    """투명 여백 정리. 작은 부스러기(1% 미만 덩어리)는 크기 계산에서 제외하되 지우지는 않는다(하트·반짝이)."""
    al = np.asarray(im)[..., 3] > 24
    if not al.any():
        return im, (0, 0)
    ys, xs = np.where(al)
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(im.width, xs.max() + 1 + pad), max(0, ys.min() - pad), min(im.height, ys.max() + 1 + pad)
    return im.crop((x0, y0, x1, y1)), (x0, y0)


def feet_anchor(im: Image.Image):
    """기준점 = 가장 큰 덩어리(몸)의 바닥 중앙. 0..1 비율."""
    al = np.asarray(im)[..., 3] > 100
    lab, n = ndimage.label(al)
    if n == 0:
        return [0.5, 1.0]
    sizes = ndimage.sum(al, lab, range(1, n + 1))
    body = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.where(body)
    bottom = ys.max()
    foot = xs[ys >= bottom - max(3, int(0.06 * (bottom - ys.min())))]
    return [round(float(foot.mean()) / im.width, 4), round(float(bottom + 1) / im.height, 4)]


def pack(frames: dict[str, Image.Image], max_w: int = 1400, gap: int = 2):
    """단순 선반(shelf) 패킹"""
    order = sorted(frames, key=lambda k: -frames[k].height)
    x = y = shelf = 0
    pos = {}
    width = 0
    for k in order:
        f = frames[k]
        if x + f.width > max_w:
            x, y, shelf = 0, y + shelf + gap, 0
        pos[k] = (x, y)
        x += f.width + gap
        shelf = max(shelf, f.height)
        width = max(width, x)
    atlas = Image.new('RGBA', (width, y + shelf), (0, 0, 0, 0))
    for k, (px, py) in pos.items():
        atlas.paste(frames[k], (px, py))
    return atlas, pos


def save_webp(im: Image.Image, path: Path, q: int = 88):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6, alpha_quality=95)


def cut_tile(t: Image.Image, grid):
    """타일 전체를 한 번에 배경 제거(모델 호출 1회) 후 칸으로 자른다. 칸 경계 3px 은 이웃 칸 찌꺼기 방지로 버린다."""
    rgba = remove_bg(t, inset=0)
    out = []
    for (name, src, raw), (_, _, cut) in zip(cells(t, grid), cells(rgba, grid)):
        out.append((name, src, cut.crop((3, 3, cut.width - 3, cut.height - 3)), raw))
    return out


def build_stage(frames_src, rel: str, meta_out: dict):
    """frames_src: (이름, 원래 이름, 배경 제거된 RGBA 칸, 원본 RGB 칸)"""
    frames, info = {}, {}
    for name, src, cell, raw in frames_src:
        opaque = name in OPAQUE
        if opaque:
            im = raw.convert('RGB').crop((2, 2, raw.width - 2, raw.height - 2)).convert('RGBA')
            anchor = [0.5, 1.0]
        else:
            im, _ = trim(cell)
            anchor = feet_anchor(im)
        frames[name] = im
        info[name] = {'anchor': anchor, **({'opaque': True} if opaque else {}), **({'source': src} if src else {})}
    atlas, pos = pack(frames)
    save_webp(atlas, OUT / f'{rel}.webp')
    meta_out['atlas'] = f'{rel}.webp'
    meta_out['size'] = [atlas.width, atlas.height]
    meta_out['frames'] = {k: {'x': pos[k][0], 'y': pos[k][1], 'w': frames[k].width, 'h': frames[k].height, **info[k]} for k in sorted(frames)}


def build_pet(slug: str):
    img = Image.open(SRC / f'{slug}.webp').convert('RGB')
    assert img.size == (3 * TILE_W, 3 * TILE_H), (slug, img.size)
    pm: dict = {'stages': {}}
    inter = FOX_INTERACTION if slug == 'fire_fox' else INTERACTION
    extra = Image.open(SRC / 'fire_fox_extra.webp').convert('RGB') if slug == 'fire_fox' else None
    for si in range(3):
        fs = cut_tile(tile(img, 0, si), BASIC) + cut_tile(tile(img, 1, si), EMOTION) + cut_tile(tile(img, 2, si), inter)
        if extra is not None:
            nz_tile = {0: (2, 0), 1: (0, 0), 2: (1, 0)}[si]  # S1: 타일2, S2: 타일0, S3: 타일1
            fs += cut_tile(tile(extra, nz_tile[0], nz_tile[1]), NUZZLE)
        sm = pm['stages'][f's{si + 1}'] = {}
        build_stage(fs, f'{slug}/s{si + 1}', sm)
        print(slug, si + 1, sm['size'], len(sm['frames']), file=sys.stderr, flush=True)
    return slug, pm


def main():
    meta: dict = {'version': 1, 'source': 'Figma Lv3HWAQS9cBVqu5zQbinCy (EGG ISLAND 펫 모션 키포즈)', 'pets': {}, 'eggs': {}, 'extra': {}}
    from multiprocessing import Pool
    with Pool(int(os.environ.get('JOBS', os.cpu_count() or 1))) as pool:
        for slug, pm in pool.imap(build_pet, PET_ORDER):
            meta['pets'][slug] = pm
    # 라인업 (도감)
    for g in range(3):
        img = Image.open(SRC / f'lineups_{g}.webp').convert('RGB')
        for i, slug in enumerate(PET_ORDER[g * 9:(g + 1) * 9]):
            t = tile(img, i % 3, i // 3)
            im, _ = trim(remove_bg(t, inset=4))
            save_webp(im, OUT / slug / 'lineup.webp')
            meta['pets'][slug]['lineup'] = {'file': f'{slug}/lineup.webp', 'size': [im.width, im.height]}
    # 알
    eggs = Image.open(SRC / 'eggs.webp').convert('RGB')
    s = eggs.width // 3
    for i, attr in enumerate(ATTRS):
        cell = eggs.crop(((i % 3) * s, (i // 3) * s, (i % 3 + 1) * s, (i // 3 + 1) * s))
        im, _ = trim(remove_bg(cell, inset=4))
        save_webp(im, OUT / 'eggs' / f'{attr}.webp', q=90)
        meta['eggs'][attr] = {'file': f'eggs/{attr}.webp', 'size': [im.width, im.height], 'anchor': feet_anchor(im)}
    # 불꽃 여우 전용
    ex = Image.open(SRC / 'fire_fox_extra.webp').convert('RGB')
    evo = []
    for name, _, cell in cells(tile(ex, 0, 1), [['evo_s2s3_01_flame_rise', 'evo_s2s3_02_silhouette', 'evo_s2s3_03_burst', 'evo_s2s3_04_reveal']]):
        im = cell.convert('RGB').crop((2, 2, cell.width - 2, cell.height - 2))
        save_webp(im, OUT / 'fire_fox/extra' / f'{name}.webp', q=86)
        evo.append({'id': name, 'file': f'fire_fox/extra/{name}.webp', 'size': [im.width, im.height]})
    turn = {}
    for si, (c, r) in enumerate([(1, 1), (2, 1), (0, 2)]):
        views = []
        for name, _, cell in cells(tile(ex, c, r), [['view_front', 'view_l45', 'view_side_l', 'view_back', 'view_r45']]):
            im, _ = trim(remove_bg(cell))
            rel = f'fire_fox/extra/s{si + 1}_{name}.webp'
            save_webp(im, OUT / rel)
            views.append({'id': name, 'file': rel, 'size': [im.width, im.height]})
        turn[f's{si + 1}'] = views
    icons = Image.open(SRC / 'icons.webp').convert('RGB')
    ic = []
    names = ['happy', 'love', 'surprise', 'sad', 'sleepy', 'angry', 'curious', 'shy', 'excited']
    s = icons.width / 3
    for i, n in enumerate(names):
        cell = icons.crop((round((i % 3) * s), round((i // 3) * s), round((i % 3 + 1) * s), round((i // 3 + 1) * s)))
        im, _ = trim(remove_bg(cell, inset=4))
        rel = f'fire_fox/extra/ui_emo_{n}.webp'
        save_webp(im, OUT / rel, q=88)
        ic.append({'id': f'ui_emo_{n}', 'file': rel, 'size': [im.width, im.height]})
    meta['extra']['fire_fox'] = {'evolution_s2_s3': evo, 'turnaround': turn, 'emotion_icons': ic}
    META.parent.mkdir(parents=True, exist_ok=True)
    META.write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    print('done', file=sys.stderr)


if __name__ == '__main__':
    main()
