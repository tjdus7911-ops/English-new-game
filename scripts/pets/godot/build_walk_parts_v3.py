#!/usr/bin/env python3
"""
설표 1단계 걷기 파츠 v3 — 검증용 (Godot·게임에는 아직 적용하지 않음)

원칙
- 사각형/직선 크롭 없음. 배경과 닿는 다리·발 윤곽은 원본 알파(원래 안티앨리어싱) 그대로 쓴다.
- 원본에 윤곽이 없는 경계(다리가 몸통·다른 다리와 붙어 있던 곳)는 실제 다리 모양을 따라 그린
  매끈한 곡선(4배 슈퍼샘플)으로 만들고, 가장자리는 블러가 아닌 '털 가닥' 형태의 알파로 처리한다.
- 관절: 다리 윗부분(어깨·엉덩이)은 회전 피벗을 중심으로 한 원형 캡 → 회전해도 윤곽이 그대로라 틈·절단면이 생기지 않는다.
- 가려져 있던 부위(다리를 지운 몸통 아랫부분, 앞다리에 가려진 먼 다리)는 LaMa 인페인팅으로 털·무늬를 복원한다.
- 깊이: 먼 다리 < 몸통(머리·꼬리 포함) < 가까운 다리

출력: art/pets/godot_src/ice_leopard_s1/parts_v3/
  body.png, leg_*.png, parts.json, check/*.png (검증 이미지)
사용: python3 build_walk_parts_v3.py --lama big-lama.pt
"""
import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'art/pets/godot_src/ice_leopard_s1/hd/pose_walk.webp'
ORIG_SHEET = ROOT / 'art/pets/godot_src/ice_leopard_s1/pose_walk.png'
OUT = ROOT / 'art/pets/godot_src/ice_leopard_s1/parts_v3'
K = 2          # 원본(native) px → HD px
SS = 4         # 곡선 래스터 슈퍼샘플
PAD = 24       # 파츠 이미지 여백 (HD px)
LAMA = None
RNG = np.random.default_rng(7)


# ───────────────────────── 기하 ─────────────────────────
def arc(c, r, a0, a1, n=24):
    """원호 점들 (각도: 도, 화면 좌표 y 아래, 0°=오른쪽, 270°=위). a0→a1 방향으로."""
    return [(c[0] + r * math.cos(math.radians(a)), c[1] + r * math.sin(math.radians(a)))
            for a in np.linspace(a0, a1, n)]


def chaikin(pts, it=3, closed=True):
    """꺾인 점들을 매끈한 곡선으로 (모서리 없음)."""
    p = np.array(pts, float)
    for _ in range(it):
        q = []
        n = len(p)
        rng = range(n) if closed else range(n - 1)
        for i in rng:
            a, b = p[i], p[(i + 1) % n]
            q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        p = np.array(q)
    return p


def sdf(pts, shape):
    """닫힌 곡선의 부호 거리(HD px, 안쪽 +). 4배 슈퍼샘플로 매끈하게."""
    H, W = shape
    m = np.zeros((H * SS, W * SS), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts) * K * SS).astype(np.int32)], 1, lineType=cv2.LINE_8)
    din = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    dout = cv2.distanceTransform(1 - m, cv2.DIST_L2, 5)
    d = (din - dout) / SS
    return cv2.resize(d, (W, H), interpolation=cv2.INTER_AREA)


_noise = {}


def fur_noise(shape, sx=0.9, sy=3.2, key=0):
    """털 가닥 노이즈 (평균 0, 표준편차 1): 가는 가닥 + 굵은 털뭉치 물결을 섞어 빗살처럼 규칙적이지 않게."""
    k = (shape, key)
    if k not in _noise:
        r = np.random.default_rng(key)
        fine = cv2.GaussianBlur(r.standard_normal(shape).astype(np.float32), (0, 0), sigmaX=sx, sigmaY=sy)
        clump = cv2.GaussianBlur(r.standard_normal(shape).astype(np.float32), (0, 0), sigmaX=5, sigmaY=5)
        fine /= fine.std() + 1e-6
        clump /= clump.std() + 1e-6
        n = 0.8 * fine + 0.45 * clump
        _noise[k] = n / (n.std() + 1e-6)
    return _noise[k]


def fur_alpha(d, amp=1.1, key=0):
    """부호 거리 → 털 가닥 가장자리 알파 (블러 아님: 가닥 모양으로 들쭉날쭉한 안티앨리어싱 윤곽)."""
    n = fur_noise(d.shape, key=key)
    hair = np.maximum(n, -0.6) * amp            # 바깥쪽으로 삐져나온 가닥이 더 잘 보이게
    return np.clip(0.5 + d + hair, 0, 1)


def leg_weight(x, y, wb):
    px, py, ax, ay, t0, t1 = wb
    return smooth(((x - px) * ax + (y - py) * ay - t0) / (t1 - t0))


def smooth(x):
    x = np.clip(x, 0, 1)
    return (x * x * (3 - 2 * x)).astype(np.float32)


def inpaint(rgb, mask):
    rgb = np.asarray(rgb).clip(0, 255).astype(np.uint8)
    H, W = mask.shape
    ph, pw = (8 - H % 8) % 8, (8 - W % 8) % 8
    im = np.pad(rgb, ((0, ph), (0, pw), (0, 0)), mode='edge')
    m = np.pad(mask, ((0, ph), (0, pw)))
    t = torch.from_numpy(im).permute(2, 0, 1)[None].float() / 255
    mt = torch.from_numpy(m.astype(np.float32))[None, None]
    with torch.no_grad():
        o = LAMA(t, mt)[0].permute(1, 2, 0).numpy()
    o = np.clip(o * 255, 0, 255).astype(np.uint8)[:H, :W]
    return np.where(mask[..., None], o, rgb).astype(np.float32)


# ───────────────────────── 윤곽 정의 (원본 좌표, 원본을 6배 확대해 따라 그림) ─────────────────────────
# 배경과 닿는 구간은 실루엣보다 살짝 바깥(원본 알파가 윤곽을 결정), 신체와 붙은 구간은 실제 다리 모양 곡선.
# cap: (중심=회전 피벗, 반지름) — 어깨·엉덩이 원형 관절
LEGS = {
    'leg_hind_near': dict(paw=(65, 262), cap=((110, 213), 24), z=2, near=True, pts=lambda c, r:
        [(34, 280), (33, 246), (44, 222), (56, 202), (70, 193), (86, 192)] + arc(c, r, 213, 332) +
        [(134, 206), (136.5, 214), (136.5, 226), (134, 235), (124, 246), (100, 248), (94, 256), (92, 280)]),
    'leg_hind_far': dict(paw=(157, 265), cap=((158, 214), 19), z=-2, near=False, pts=lambda c, r:
        arc(c, r, 200, 378) + [(176, 228), (176.5, 246), (175.5, 262), (175, 281), (134, 281),
                                (133, 262), (134, 246), (137, 232), (134, 218), (135, 204)]),
    'leg_front_far': dict(paw=(202, 265), cap=((200, 214), 21), z=-1, near=False, pts=lambda c, r:
        arc(c, r, 162, 300) + [(226, 199), (232, 207), (233.5, 217), (231.5, 224), (224, 231), (226, 238), (228, 252), (230, 266), (231, 282), (174.5, 282),
                                (174, 266), (174.5, 252), (175.5, 240), (178.5, 226)]),
    'leg_front_near': dict(paw=(322, 255), cap=((250, 209), 24), z=3, near=True, pts=lambda c, r:
        arc(c, r, 155, 322) + [(282, 192), (300, 204), (322, 222), (344, 238), (346, 262), (334, 278),
                               (290, 280), (262, 266), (240, 250), (226, 238), (224, 228), (226.5, 219)]),
}
# 다리를 모두 숨긴 몸통의 아랫선 (배·가슴). 엉덩이 뒤쪽·가슴 앞은 원본 실루엣과 만난다.
BELLY = [(84, 192), (100, 200), (120, 208), (145, 214), (170, 217), (195, 216), (218, 211), (238, 204),
         (258, 200), (270, 202), (279, 206), (284, 210), (286.5, 214)]
PIVOT_ORDER = ['leg_hind_far', 'leg_front_far', 'body', 'leg_hind_near', 'leg_front_near']


def main():
    global LAMA
    ap = argparse.ArgumentParser()
    ap.add_argument('--lama', required=True)
    LAMA = torch.jit.load(ap.parse_args().lama, map_location='cpu').eval()
    (OUT / 'check').mkdir(parents=True, exist_ok=True)

    a = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
    H, W = a.shape[:2]
    # 여백 확보: 캔버스를 키워 파츠가 잘리지 않게
    P = 40
    a = np.pad(a, ((P, P), (P, P), (0, 0)))
    H, W = a.shape[:2]
    off = P / K                                    # 원본 좌표 오프셋
    sh = lambda pts: [(x + off, y + off) for x, y in pts]
    al = a[..., 3] / 255
    rgbw = a[..., :3] * al[..., None] + 255 * (1 - al[..., None])
    yy = np.arange(H)[:, None].astype(np.float32)

    # 다리 윤곽 SDF
    legs = {}
    for n, L in LEGS.items():
        c, r = L['cap']
        c = (c[0] + off, c[1] + off)
        pts = chaikin(sh(L['pts']((c[0] - off, c[1] - off), r)), it=3)
        legs[n] = dict(L, d=sdf(pts, (H, W)), c=c, pts=pts)
        legs[n]['inside'] = legs[n]['d'] > 0
        # 스키닝 가중치: 어깨·엉덩이 위쪽은 몸통에 붙어 움직이지 않고(0), 피벗 아래로 갈수록 다리 뼈를 따른다(1)
        # 가중치는 '다리 축 방향 거리'로: 피벗에서 발 쪽으로 갈수록 1 (가로로 뻗은 앞다리도 위로 들 때 접히지 않게)
        px, py = c[0] * K, c[1] * K
        ax = np.array(L['paw'], float) + off - np.array(c)
        ax /= np.linalg.norm(ax)
        wb = [px, py, float(ax[0]), float(ax[1]), -2 * K, 20 * K]
        legs[n]['wband'] = wb
        legs[n]['w'] = leg_weight(np.arange(W)[None, :].astype(np.float32), yy, wb)
    # 몸통에서 지워야 할 다리 흔적: 가까운 다리가 실제로 움직이는 부분(가중치 0.15 이상)
    near_moving = np.zeros((H, W), bool)
    for n in ('leg_hind_near', 'leg_front_near'):
        near_moving |= legs[n]['inside'] & (legs[n]['w'] > 0.15)

    # ── 몸통: 아랫선 위쪽 전체(머리·꼬리 포함), 다리 흔적은 인페인팅으로 몸통 털로 바꾼다 ──
    belly = chaikin(sh(BELLY), it=3, closed=False)
    # 가슴 앞: 앞다리 어깨 앞쪽까지 가슴 윤곽을 내려 그린 뒤 위로 닫는다 (다리를 뒤로 젖혀도 가슴이 패이지 않게)
    body_poly = np.vstack([[[-50, belly[0][1]]], belly, [[287 + off, 205 + off], [285.5 + off, 194 + off], [285 + off, 160 + off], [W / K + 50, 160 + off],
                           [W / K + 50, -50], [-50, -50]]])
    d_body = sdf(body_poly, (H, W))
    body_in = d_body > 0
    # 인페인팅 영역: 가까운 다리가 움직이며 드러나는 자리 + 아랫선 위 배경 틈. 그 밖은 원본 픽셀 그대로(정지 자세 = 원본)
    xs = np.arange(W)[None, :] / K - off
    # 아랫선 위의 '안쪽' 틈만 (실루엣 바깥 배경은 제외): 실루엣을 닫기 연산으로 메운 것과 비교
    closed = cv2.morphologyEx((al > 0.5).astype(np.uint8), cv2.MORPH_CLOSE,
                              cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15 * K, 15 * K))) > 0
    gaps = body_in & (al < 0.6) & closed & (d_body < 14 * K) & (xs > 98) & (xs < 276)
    fill_m = (near_moving & body_in & (d_body > -6 * K)) | gaps
    body_rgb = inpaint(rgbw, fill_m)
    body_al = np.where(fill_m, 1.0, al)
    body_al = np.minimum(body_al, fur_alpha(d_body, key=1))
    parts = {'body': (body_rgb, body_al, (0, 0))}
    wbands = {}

    # ── 다리 ──
    in_front = {'leg_hind_far': ['leg_hind_near', 'leg_front_far', 'leg_front_near'],
                'leg_front_far': ['leg_front_near'], 'leg_hind_near': [], 'leg_front_near': []}
    for n, L in legs.items():
        inside = L['inside']
        occl = np.zeros_like(inside)
        for o in in_front[n]:
            occl |= legs[o]['inside']
        occl &= inside
        # 다리 사이에 남아 있던 배경 흰 조각(배경 제거 잔여)도 복원 대상으로
        white = (a[..., :3].min(-1) > 236) & (al > 0.3) & inside & (L['d'] < 10 * K)
        white_fix = cv2.dilate(white.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & inside & ~occl
        # 다리와 다리 사이의 좁은 배경 틈(실루엣 안쪽 오목한 곳)도 이 다리의 털로 채움 — 관절이 벌어질 때 구멍 방지
        if not L['near']:
            occl |= inside & closed & (al < 0.6) & (L['d'] > 0) & (yy < (L['c'][1] + 18) * K)
        # 몸통 위로 올라간 캡 부분 중 원본이 몸통 털인 곳은 그대로(정지 자세에서 원본과 동일), 다른 다리에 가려진 곳만 복원
        rgb = a[..., :3].copy()
        base_al = al.copy()
        if occl.any() or white_fix.any():
            fill = inpaint(rgbw, occl | white_fix)
            rgb = np.where((occl | white_fix)[..., None], fill, rgb)
            base_al = np.where(occl, 1.0, base_al)          # 흰 잔여 조각은 색만 털로 바꾸고 알파(윤곽)는 원본 유지
        # 다리 바닥: 발바닥 아래로 복원이 넘치지 않게 원본 바닥선 기준
        ground = np.where(al.max(1) > 0.5)[0].max()
        base_al = np.where(occl & (yy > ground - 1), al, base_al)
        la = np.minimum(base_al, fur_alpha(L['d'], key=sum(map(ord, n))))
        # 바닥 접지 그림자 제거: 발 밑의 검은 반투명 그림자(발 윤곽선은 회색이라 남음) → 다리를 들면 그림자가 따라 뜨지 않게
        luma = a[..., :3].mean(-1)
        rows = np.arange(H)[:, None]
        shadow_keep = np.clip((luma - 45) / 45, 0, 1)
        la = la * np.where(rows > ground - 12 * K, shadow_keep, 1)
        # 만든 경계(원본 알파가 1인데 곡선이 자른 곳) 안쪽에 둥근 음영 → 원기둥 같은 다리 입체감
        cut = (al > 0.9) & (L['d'] < 6 * K)
        ao = 1 - 0.10 * np.clip(1 - L['d'] / (6 * K), 0, 1) * cut * L['w']   # 몸통에 붙은 윗부분엔 음영 없음
        rgb = rgb * ao[..., None]
        parts[n] = (rgb, la, (L['c'][0] * K, L['c'][1] * K))
        wbands[n] = L['wband']

    # 저장 (여백 포함 크롭)
    meta = {'canvas': [W, H], 'pad_native': off, 'k': K, 'order': PIVOT_ORDER, 'parts': {}}
    imgs = {}
    for n, (rgb, alpha, piv) in parts.items():
        im = Image.fromarray(np.dstack([rgb.clip(0, 255), (alpha * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')
        bb = im.getbbox()
        bb = (max(0, bb[0] - PAD), max(0, bb[1] - PAD), min(W, bb[2] + PAD), min(H, bb[3] + PAD))
        crop = im.crop(bb)
        crop.save(OUT / f'{n}.png')
        imgs[n] = (crop, bb, piv, wbands.get(n))
        meta['parts'][n] = {'file': f'{n}.png', 'pos': [bb[0], bb[1]], 'size': list(crop.size),
                            'pivot': [round(piv[0], 1), round(piv[1], 1)],
                            'weight_axis': [round(v, 4) for v in wbands[n]] if n in wbands else None,  # [피벗x, 피벗y, 축x, 축y, t0, t1] (HD px)
                            'z': {'leg_hind_far': -2, 'leg_front_far': -1, 'body': 0, 'leg_hind_near': 2, 'leg_front_near': 3}[n]}
    (OUT / 'parts.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    make_checks(imgs, (W, H), a)


# ───────────────────────── 검증 이미지 ─────────────────────────
BGS = {'light': (236, 241, 248), 'dark': (34, 32, 48), 'mid': (150, 190, 230)}


def checker(size, s=16):
    w, h = size
    y, x = np.mgrid[0:h, 0:w]
    c = (((x // s) + (y // s)) % 2).astype(np.uint8)
    v = np.where(c[..., None] == 1, 205, 245).repeat(3, 2).astype(np.uint8)
    return Image.fromarray(v).convert('RGBA')


def on(bg, im):
    b = (checker(im.size) if bg == 'checker' else Image.new('RGBA', im.size, BGS[bg] + (255,)))
    b.alpha_composite(im)
    return b


def compose(imgs, size, rot=None, lift=None):
    """파츠 조립. 다리는 선형 블렌드 스키닝(윗부분 가중치 0 → 몸통에 고정, 아래로 갈수록 다리 회전·들어올림)."""
    rot = rot or {}
    lift = lift or {}
    W, H = size
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    for n in PIVOT_ORDER:
        crop, bb, piv, wb = imgs[n]
        layer = Image.new('RGBA', size, (0, 0, 0, 0))
        layer.alpha_composite(crop, (bb[0], bb[1]))
        th, lf = rot.get(n, 0.0), lift.get(n, 0.0)
        if wb and (th or lf):
            # 역변환: 출력 q 의 원래 위치 s = p + R(-w·θ)(q - p + (0, w·lift)), w 는 s 기준으로 두 번 보정
            sx, sy = X, Y
            for _ in range(3):
                w = leg_weight(sx, sy, wb)
                a = -w * th
                c, s_ = np.cos(a), np.sin(a)
                dx, dy = X - piv[0], Y - piv[1] + w * lf
                # 화면 좌표(y 아래)에서 반시계 회전 = PIL rotate 와 같은 방향
                sx = piv[0] + c * dx + s_ * dy
                sy = piv[1] - s_ * dx + c * dy
            arr = cv2.remap(np.asarray(layer), sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC,
                            borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
            # 프리멀티플라이 없이 보간하면 가장자리에 검은 테 → 알파 가중 보간
            pm = np.asarray(layer).astype(np.float32)
            pm[..., :3] *= pm[..., 3:] / 255
            pr = cv2.remap(pm, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
            al_ = np.clip(pr[..., 3], 0, 255)
            rgb = np.where(al_[..., None] > 0.5, pr[..., :3] * 255 / np.maximum(al_[..., None], 1e-3), 0)
            layer = Image.fromarray(np.dstack([rgb.clip(0, 255), al_]).astype(np.uint8), 'RGBA')
        canvas.alpha_composite(layer)
    return canvas


def label(im, text):
    from PIL import ImageDraw, ImageFont
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 22)
    except OSError:
        try:
            f = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 22)
        except OSError:
            f = ImageFont.load_default()
    d.rectangle([0, 0, im.width, 34], fill=(255, 255, 255, 230))
    d.text((10, 4), text, fill=(40, 30, 70), font=f)
    return im


def grid(cells, cols):
    w = max(c.width for c in cells)
    h = max(c.height for c in cells)
    rows = (len(cells) + cols - 1) // cols
    S = Image.new('RGBA', (w * cols, h * rows), (255, 255, 255, 255))
    for i, c in enumerate(cells):
        S.alpha_composite(c, ((i % cols) * w, (i // cols) * h))
    return S


def make_checks(imgs, size, a):
    C = OUT / 'check'
    # 1) 다리를 숨긴 몸통 — 체커(투명)·밝은·어두운 배경
    body = imgs['body'][0]
    grid([label(on(bg, body), f'1. 다리를 숨긴 몸통 · {nm}') for bg, nm in
          [('checker', '투명'), ('light', '밝은 배경'), ('dark', '어두운 배경')]], 3).convert('RGB').save(C / '1_body_no_legs.png')
    # 2) 다리 4개 — 세 배경, 각각 원래 크기
    cells = []
    for n, nm in [('leg_hind_near', '뒷다리·가까운'), ('leg_hind_far', '뒷다리·먼'), ('leg_front_far', '앞다리·먼'), ('leg_front_near', '앞다리·가까운')]:
        im = imgs[n][0]
        for bg in ('checker', 'light', 'dark'):
            cells.append(label(on(bg, im.resize((im.width, im.height))), nm))
    grid(cells, 3).convert('RGB').save(C / '2_legs.png')
    # 3) 조립 정지 vs 원본
    orig = Image.fromarray(a.astype(np.uint8), 'RGBA')
    still = compose(imgs, size)
    grid([label(on('light', orig), '원본'), label(on('light', still), '3. 파츠 조립 정지'),
          label(on('dark', still), '3. 조립 · 어두운 배경')], 3).convert('RGB').save(C / '3_assembled.png')
    # 차이 확인용 수치
    da = np.abs(np.asarray(still).astype(np.float32) - a)
    print('조립 vs 원본: 평균 RGB 차이', float(da[..., :3][a[..., 3] > 200].mean()), '알파 차이', float(da[..., 3].mean()))
    # 4) 극단 자세 (대각선 다리 쌍 반대로 크게)
    A = 0.42
    poses = [
        ('4-A. 앞(가까운)·뒤(먼) 앞으로 / 반대쪽 뒤로', {'leg_front_near': -A, 'leg_hind_far': -A, 'leg_front_far': A, 'leg_hind_near': A}, {'leg_front_near': 10, 'leg_hind_far': 10}),
        ('4-B. 반대 쌍', {'leg_front_near': A, 'leg_hind_far': A, 'leg_front_far': -A, 'leg_hind_near': -A}, {'leg_front_far': 10, 'leg_hind_near': 10}),
        ('4-C. 갤럽 모음', {'leg_front_near': 0.55, 'leg_front_far': 0.45, 'leg_hind_near': -0.5, 'leg_hind_far': -0.42}, {}),
        ('4-D. 갤럽 폄', {'leg_front_near': -0.6, 'leg_front_far': -0.5, 'leg_hind_near': 0.55, 'leg_hind_far': 0.45}, {}),
    ]
    cells = []
    for nm, rot, lift in poses:
        im = compose(imgs, size, rot, lift)
        cells += [label(on('light', im), nm), label(on('dark', im), nm + ' · 어두운')]
    grid(cells, 2).convert('RGB').save(C / '4_extreme.png')


if __name__ == '__main__':
    main()
