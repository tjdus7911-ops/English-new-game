#!/usr/bin/env python3
"""고해상도 디스플레이용 업스케일 — Real-ESRGAN(realesr-general-x4v3, BSD-3) ×4 추론 후 목표 배율로 고품질 축소.
투명 이미지: 색은 모델로, 알파는 Lanczos 로 확대(경계 번짐 방지를 위해 투명 영역 색을 주변색으로 채운 뒤 처리).
사용: python3 upscale.py MODEL in.webp out.webp [scale=2] [quality=90]"""
import sys
import numpy as np
import torch
from PIL import Image
from scipy import ndimage
from spandrel import ModelLoader

torch.set_num_threads(max(1, torch.get_num_threads()))
_model = None


def model(path):
    global _model
    if _model is None:
        _model = ModelLoader().load_from_file(path).model.eval()
    return _model


def sr_rgb(arr, mpath, tile=384, pad=16):
    m = model(mpath)
    h, w, _ = arr.shape
    out = np.zeros((h * 4, w * 4, 3), np.float32)
    x = torch.from_numpy(arr.astype(np.float32) / 255).permute(2, 0, 1)[None]
    with torch.inference_mode():
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                ya, yb = max(0, y0 - pad), min(h, y0 + tile + pad)
                xa, xb = max(0, x0 - pad), min(w, x0 + tile + pad)
                o = m(x[:, :, ya:yb, xa:xb])[0].permute(1, 2, 0).clamp(0, 1).numpy()
                oy, ox = (y0 - ya) * 4, (x0 - xa) * 4
                th, tw = min(tile, h - y0) * 4, min(tile, w - x0) * 4
                out[y0 * 4:y0 * 4 + th, x0 * 4:x0 * 4 + tw] = o[oy:oy + th, ox:ox + tw]
    return (out * 255 + 0.5).astype(np.uint8)


def upscale(img: Image.Image, mpath: str, scale: float = 2) -> Image.Image:
    rgba = img.convert('RGBA')
    a = np.asarray(rgba)
    alpha = a[..., 3]
    rgb = a[..., :3].copy()
    has_alpha = alpha.min() < 255
    if has_alpha:
        # 투명 영역 색을 가장 가까운 불투명 픽셀 색으로 채움 (헤일로 방지)
        solid = alpha > 8
        if solid.any():
            _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
            rgb = rgb[iy, ix]
    big = Image.fromarray(sr_rgb(rgb, mpath))
    W, H = round(img.width * scale), round(img.height * scale)
    big = big.resize((W, H), Image.LANCZOS)
    if has_alpha:
        al = Image.fromarray(alpha).resize((W, H), Image.LANCZOS)
        big = big.convert('RGBA'); big.putalpha(al)
    return big


if __name__ == '__main__':
    mp, src, dst = sys.argv[1:4]
    sc = float(sys.argv[4]) if len(sys.argv) > 4 else 2
    q = int(sys.argv[5]) if len(sys.argv) > 5 else 90
    out = upscale(Image.open(src), mp, sc)
    out.save(dst, 'WEBP', quality=q, method=6, alpha_quality=95)
