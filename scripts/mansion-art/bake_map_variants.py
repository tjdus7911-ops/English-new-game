"""
전체 저택 맵(map/mansion)의 거실에도 고른 디자인을 반영 — 거실 장면과 같은 저장 데이터(renovations[작업].selectedVariantId)를 쓴다.
같은 색 변형(색상만 바꿈)을 맵 그림 속 소파·안락의자·커튼·러그에 적용한 조각을 만든다.
결과: public/assets/game/map/var-<작업>-<디자인>.webp, src/game/mansion/mapVariants.json
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
M = np.asarray(Image.open(os.path.join(ROOT, 'public/assets/game/map/mansion.webp')).convert('RGB')).astype(np.float32)
H, W = M.shape[:2]
f = M / 255; mx, mn = f.max(2), f.min(2); d = mx - mn + 1e-6
r, g, b = f[..., 0], f[..., 1], f[..., 2]
hh = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
ss = np.where(mx > 0, d / (mx + 1e-6), 0); vv = mx
def rgb_from(h, s, v):
    i = np.floor(h * 6) % 6; fr = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - fr * s), v * (1 - (1 - fr) * s)
    ii = i.astype(int)
    return np.dstack([np.choose(ii, [v, q, p, p, t, v]), np.choose(ii, [t, v, v, q, p, p]), np.choose(ii, [p, p, t, v, v, q])]) * 255
def poly(pts):
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon(pts, fill=255)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
def hue_in(lo, hi): lo /= 360; hi /= 360; return ((hh >= lo) & (hh <= hi)) if lo <= hi else ((hh >= lo) | (hh <= hi))
def soft(c): return np.asarray(Image.fromarray((c * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
OUT = os.path.join(ROOT, 'public/assets/game/map'); out = {}
def var(task, vid, region, sel, fn):
    m = region * sel
    nh, ns, nv = fn(hh.copy(), ss.copy(), vv.copy())
    rgb = rgb_from(np.mod(nh, 1), np.clip(ns, 0, 1), np.clip(nv, 0, 1))
    a = (m * 255).astype(np.uint8); bb = Image.fromarray(a).getbbox()
    im = Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA').crop(bb)
    key = f'var-{task}-{vid}'; im.save(f'{OUT}/{key}.webp', 'WEBP', quality=88, method=6)
    out.setdefault(task, {})[vid] = {'key': f'map/{key}', 'x': bb[0], 'y': bb[1], 'w': im.width, 'h': im.height}
SOFA = poly([(420, 410), (470, 395), (578, 420), (580, 470), (530, 482), (425, 445)])
red = soft(hue_in(330, 25) & (ss > 0.3) & (vv > 0.12))
var('C15', 'sofa-green', SOFA, red, lambda h, s, v: (h * 0 + 0.25, s * 0.42, v * 0.95))
var('C15', 'sofa-cloud', SOFA, red, lambda h, s, v: (h * 0 + 0.075, s * 0.85, np.minimum(1, v * 1.15)))
grn = soft(hue_in(45, 160) & (ss > 0.15) & (vv > 0.05))
ARM1 = poly([(292, 455), (340, 448), (358, 480), (352, 515), (305, 515), (290, 485)])
ARM2 = poly([(358, 508), (408, 505), (425, 535), (418, 558), (368, 558), (356, 530)])
for t, R in [('C16', ARM1), ('C17', ARM2)]:
    var(t, 'arm-rose', R, grn, lambda h, s, v: (h * 0 + 0.975, s * 0.6, np.minimum(1, v * 1.15)))
    var(t, 'arm-brown', R, grn, lambda h, s, v: (h * 0 + 0.06, s * 0.9, v * 0.95))
CURT = poly([(410, 238), (472, 238), (464, 402), (410, 402)]) + poly([(493, 245), (568, 245), (562, 402), (518, 402)]) + poly([(410, 236), (568, 236), (568, 282), (410, 282)])
var('D26', 'cur-ivory', np.clip(CURT, 0, 1), red, lambda h, s, v: (h * 0 + 0.105, s * 0.4, np.minimum(1, v * 1.3 + 0.08)))
var('D26', 'cur-olive', np.clip(CURT, 0, 1), red, lambda h, s, v: (h * 0 + 0.17, s * 0.5, v * 0.85))
RUG = poly([(290, 520), (440, 410), (630, 465), (480, 580)]) * (1 - SOFA) * (1 - ARM1) * (1 - ARM2)
rugsel = soft(hue_in(320, 40) & (ss < 0.6) & (vv > 0.35))
var('D27', 'rug-check', RUG, rugsel, lambda h, s, v: (h * 0 + 0.22, s * 0.33, v * 0.97))
var('D27', 'rug-lily', RUG, rugsel, lambda h, s, v: (h * 0 + 0.11, s * 0.65, v))
json.dump(out, open(os.path.join(ROOT, 'src/game/mansion/mapVariants.json'), 'w'), ensure_ascii=False, indent=1)
for mp in ['src/game/manifest.json', 'public/assets/game/manifest.json']:
    mpath = os.path.join(ROOT, mp); doc = json.load(open(mpath))
    for vs in out.values():
        for p in vs.values(): doc['items'][p['key']] = {'w': p['w'], 'h': p['h'], 'anchor': [p['w'] // 2, p['h'] // 2], 'sheet': '전체 맵 거실 디자인 반영 (bake_map_variants.py)'}
    json.dump(doc, open(mpath, 'w'), ensure_ascii=False, indent=1)
# 미리보기: 모두 두 번째 디자인
prev = Image.fromarray(M.astype(np.uint8)).convert('RGBA')
for t, vs in out.items():
    p = list(vs.values())[0]; prev.alpha_composite(Image.open(os.path.join(ROOT, 'public/assets/game', p['key'] + '.webp')), (p['x'], p['y']))
prev.crop((260, 230, 660, 600)).resize((800, 740)).convert('RGB').save('/tmp/claude-0/-home-claude/77c19c0d-fa3d-5b32-b043-3a21ea98cb3e/scratchpad/mapvar.jpg')
print({k: list(v) for k, v in out.items()})
