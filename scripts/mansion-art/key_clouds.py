"""구름 시트(마젠타 배경) → 투명 구름 6개. 마젠타와 섞인 반투명 가장자리를 색 분리(언믹스)해 분홍 테를 없앤다."""
import os
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
im = np.asarray(Image.open(os.path.join(ROOT, 'art/figma-a/map/clouds-3x2_47-2.png')).convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
m = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)
a = np.clip(1 - m * 1.25, 0, 1)
M = np.array([255, 0, 255], np.float32)
C = (im - (1 - a)[..., None] * M) / np.maximum(a, 0.05)[..., None]
C = np.clip(C, 0, 255)
# 남은 분홍 기운은 따뜻한 흰색 쪽으로
lum = C.mean(axis=2, keepdims=True)
pink = np.clip((np.minimum(C[..., 0], C[..., 2]) - C[..., 1]) / 60, 0, 1)[..., None]
C = C * (1 - pink) + lum * np.array([1.02, 0.98, 0.93]) * pink
edge = np.clip((a - 0.45) / 0.45, 0, 1)[..., None]
C = C * edge + np.array([236, 226, 220], np.float32) * (1 - edge)
a = a * (0.55 + 0.45 * edge[..., 0])
out = np.dstack([np.clip(C, 0, 255), a * 255]).astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
cw, ch = img.width // 3, img.height // 2
os.makedirs(os.path.join(ROOT, 'public/assets/game/map'), exist_ok=True)
for k in range(6):
    c = img.crop(((k % 3) * cw, (k // 3) * ch, (k % 3 + 1) * cw, (k // 3 + 1) * ch))
    bb = c.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    c.crop(bb).save(os.path.join(ROOT, f'public/assets/game/map/cloud-{k + 1}.webp'), 'WEBP', quality=88)
print('clouds ok')
