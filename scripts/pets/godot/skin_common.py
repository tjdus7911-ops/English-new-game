"""스키닝 메시 공용 도구 — 격자 메시, 단단한(rigid) 파츠 분리, LaMa 인페인팅.

머리·꼬리처럼 크게 움직이는 부위는 몸통과 한 그림 안에서 휘게 하면 연결부 털이 고무처럼 늘어난다.
그래서 별도 층으로 떼어 '단단하게' 돌리고, 그 뒤로 드러나는 자리(목·엉덩이·꼬리 뿌리)는 LaMa 로 털을 채운다.
"""
import math

import cv2
import numpy as np
import torch

G = 8
LAMA_PATH = None
_LAMA = None


def lama():
    global _LAMA
    if _LAMA is None:
        _LAMA = torch.jit.load(LAMA_PATH, map_location='cpu').eval()
    return _LAMA


def inpaint(rgb, mask):
    rgb = np.asarray(rgb).clip(0, 255).astype(np.uint8)
    H, W = mask.shape
    ph, pw = (8 - H % 8) % 8, (8 - W % 8) % 8
    im = np.pad(rgb, ((0, ph), (0, pw), (0, 0)), mode='edge')
    m = np.pad(mask, ((0, ph), (0, pw)))
    t = torch.from_numpy(im).permute(2, 0, 1)[None].float() / 255
    mt = torch.from_numpy(m.astype(np.float32))[None, None]
    with torch.no_grad():
        o = lama()(t, mt)[0].permute(1, 2, 0).numpy()
    o = np.clip(o * 255, 0, 255).astype(np.uint8)[:H, :W]
    return np.where(mask[..., None], o, rgb).astype(np.float32)


def chaikin(pts, it=3, closed=True):
    p = np.array(pts, float)
    for _ in range(it):
        q = []
        n = len(p)
        for i in (range(n) if closed else range(n - 1)):
            a, b = p[i], p[(i + 1) % n]
            q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        p = np.array(q)
    return p


def sdf(pts_px, shape, ss=4):
    """닫힌 다각형(픽셀 좌표)의 부호 거리 (안쪽 +, px). 슈퍼샘플로 매끈하게."""
    H, W = shape
    m = np.zeros((H * ss, W * ss), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts_px) * ss).astype(np.int32)], 1)
    d = (cv2.distanceTransform(m, cv2.DIST_L2, 5) - cv2.distanceTransform(1 - m, cv2.DIST_L2, 5)) / ss
    return cv2.resize(d, (W, H), interpolation=cv2.INTER_AREA)


def region(curve_px, close_px, shape):
    """곡선 + 닫는 점들로 만든 영역의 부호 거리 (영역 안 +, px). 곡선 부분이 실제 경계가 된다."""
    poly = np.vstack([np.array(curve_px, float), np.array(close_px, float)])
    return sdf(poly, shape)


_noise = {}


def fur_alpha(d, amp=1.1, key=0):
    """부호 거리 → 털 가닥 모양의 가장자리 알파 (블러가 아닌 들쭉날쭉한 털 윤곽)."""
    k = (d.shape, key)
    if k not in _noise:
        r = np.random.default_rng(key)
        fine = cv2.GaussianBlur(r.standard_normal(d.shape).astype(np.float32), (0, 0), sigmaX=0.9, sigmaY=3.2)
        clump = cv2.GaussianBlur(r.standard_normal(d.shape).astype(np.float32), (0, 0), sigmaX=5, sigmaY=5)
        n = 0.8 * fine / (fine.std() + 1e-6) + 0.45 * clump / (clump.std() + 1e-6)
        _noise[k] = n / (n.std() + 1e-6)
    return np.clip(0.5 + d + np.maximum(_noise[k], -0.6) * amp, 0, 1)


def mesh(alpha, pos=(0, 0)):
    """알파가 있는 칸만 덮는 격자 메시. verts 는 캔버스 좌표(pos 더함), uvs 는 텍스처 좌표."""
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
                verts.append([pos[0] + u, pos[1] + v])
    for i, j in cells:
        a, b, c, d = idx[j, i], idx[j, i + 1], idx[j + 1, i], idx[j + 1, i + 1]
        tris += [[int(a), int(b), int(d)], [int(a), int(d), int(c)]]
    return np.array(verts, float), uvs, tris


def crop_save(rgb, alpha, path, pad=8):
    from PIL import Image
    im = Image.fromarray(np.dstack([np.asarray(rgb).clip(0, 255), (np.asarray(alpha) * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')
    bb = im.getbbox()
    bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad))
    im.crop(bb).save(path)
    return bb


def rigid_part(file, z, bone, alpha_crop, pos):
    V, uvs, tris = mesh(alpha_crop, pos)
    return {'file': file, 'z': z, 'verts': np.round(V, 2).tolist(), 'uvs': uvs, 'tris': tris,
            'weights': {bone: [1.0] * len(V)}}
