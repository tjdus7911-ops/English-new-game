"""
시안 A v3 거실 장면 굽기 — 게임은 확정 v3 그림(STEP 4)을 그대로 바탕으로 쓰고,
미완료 미션의 '이전 상태' 레이어를 그 위에 겹쳐 STEP 0→4 를 재현한다 (Figma 38:2 와 같은 레이어·같은 위치).

- 레이어 모양(알파): Figma 레이어 단독 렌더 (art/figma-a/steps/38-xx.png)
- 레이어 색: 그 레이어가 아직 남아 있는 마지막 단계 합성본(STEP0~3)에서 그대로 잘라 옴 → 블렌드·불투명도까지 Figma 와 동일
- 선택지 3종: 원본(v3) + 같은 모양 색상 변형 2종(마스크 안의 해당 색만 바꿈). 조명·장식은 시안 A 소품을 더함
결과: public/assets/game/scene/*.webp, src/game/mansion/scene.json
사용: python3 scripts/mansion-art/bake_scene.py
"""
import colorsys, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
A = os.path.join(ROOT, 'art/figma-a')
OUT = os.path.join(ROOT, 'public/assets/game/scene')
os.makedirs(OUT, exist_ok=True)
W, H = 1536, 864
load = lambda p: np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
C = {0: load(f'{A}/a-step0-before.png'), 1: load(f'{A}/steps/step1-cleaned_38-71.png'), 2: load(f'{A}/steps/step2-repaired_38-120.png'),
     3: load(f'{A}/steps/step3-interior_38-143.png'), 4: load(f'{A}/a-v3-final.png')}
V3 = C[4]

# Figma 38:5 (STEP 0) 레이어: id, 위치·크기(metadata), 미션, 색을 가져올 단계 — Figma 쌓임 순서(아래→위)
LAYERS = [
  ('38-22', 120, 0, 372, 560, 'B8', 1), ('38-25', 605, 0, 395, 320, 'B8', 1), ('38-28', 1010, 0, 526, 360, 'B8', 1),
  ('38-97', 0, 245, 1536, 619, 'B9', 1),  # 바닥 마모 (청소 후에도 남음)
  ('38-31', 0, 245, 1536, 619, 'A2', 0),  # 바닥 먼지·마모
  ('38-34', 1250, 150, 286, 570, 'A2', 0), ('38-37', 630, 528, 225, 124, 'A2', 0),
  ('38-40', 195, 30, 1267, 530, 'D23', 2),  # 꺼진 조명
  ('38-41', 150, 196, 64, 116, 'B8', 1), ('38-42', 196, 186, 34, 46, 'B8', 1), ('38-43', 452, 100, 30, 90, 'B8', 1),
  ('38-44', 632, 62, 52, 94, 'B8', 1), ('38-45', 678, 62, 22, 50, 'B8', 1), ('38-46', 1176, 96, 68, 80, 'B8', 1), ('38-47', 300, 40, 606, 170, 'B8', 1),
  ('38-48', 497, 49, 103, 235, 'A6', 0), ('38-49', 520, 90, 63, 170, 'A6', 0), ('38-50', 6, 274, 102, 324, 'A6', 0),
  ('38-53', 258, 300, 134, 132, 'B12', 1), ('38-56', 200, 400, 270, 130, 'B12', 1), ('38-57', 280, 409, 92, 11, 'A7', 1),
  # 가구 3개는 Figma 에서 좌우 반전된 노드라 metadata x 가 오른쪽 끝 → x - w
  ('38-58', 830 - 425, 330, 425, 333, 'A5', 2), ('38-59', 434 - 172, 548, 172, 199, 'C16', 2), ('38-60', 628 - 200, 632, 200, 231, 'C17', 2),
  ('38-61', 110, 650, 200, 157, 'A1', 0), ('38-62', 20, 560, 150, 154, 'A4', 0), ('38-63', 830, 380, 190, 146, 'A2', 0),
  ('38-64', 960, 520, 170, 138, 'A1', 0), ('38-65', 1170, 470, 120, 157, 'A4', 0),
  ('38-66', 405, -10, 120, 138, 'A3', 0), ('38-67', 1085, -6, 110, 126, 'A3', 0), ('38-68', 1338, 250, 100, 115, 'A3', 0),
]

def mask_of(lid, w, h):
    a = Image.open(f'{A}/steps/{lid}.png').convert('RGBA').getchannel('A').resize((w, h), Image.LANCZOS)
    m = np.asarray(a).astype(np.float32)
    mx = m.max() or 1
    return np.clip(m / mx * 1.15, 0, 1)  # 불투명도는 합성본 색에 이미 들어 있으므로 모양만 사용

def piece(src, x, y, w, h, m, key):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    mm = m[y0 - y:y1 - y, x0 - x:x1 - x]
    rgb = src[y0:y1, x0:x1]
    diff = np.abs(rgb - V3[y0:y1, x0:x1]).max(axis=2)
    mm = mm * np.clip(diff / 6, 0, 1)  # v3 와 같은 픽셀은 굳이 덮지 않음 (용량·경계 감소)
    alpha = (mm * 255).astype(np.uint8)
    bb = Image.fromarray(alpha).getbbox()
    if not bb: return None
    im = Image.fromarray(np.dstack([rgb, alpha * 1.0]).astype(np.uint8), 'RGBA').crop(bb)
    im.save(f'{OUT}/{key}.webp', 'WEBP', quality=86, method=6)
    return {'key': f'scene/{key}', 'x': x0 + bb[0], 'y': y0 + bb[1], 'w': im.width, 'h': im.height}

layers = []
for lid, x, y, w, h, task, step in LAYERS:
    p = piece(C[step], x, y, w, h, mask_of(lid, w, h), f'pre-{task}-{lid}')
    if p: layers.append({**p, 'task': task, 'figma': lid.replace('-', ':')})

# ── 색상 변형 (같은 모양, 마스크 안의 해당 색만) ──
def hsv(img):
    f = img / 255.0
    mx, mn = f.max(axis=2), f.min(axis=2)
    d = mx - mn + 1e-6
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    s = np.where(mx > 0, d / (mx + 1e-6), 0)
    return h, s, mx
def rgb_from(h, s, v):
    i = np.floor(h * 6) % 6; f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    r = np.choose(i.astype(int), [v, q, p, p, t, v]); g = np.choose(i.astype(int), [t, v, v, q, p, p]); b = np.choose(i.astype(int), [p, p, t, v, v, q])
    return np.dstack([r, g, b]) * 255
def poly_mask(pts):
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon(pts, fill=255)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
def layer_mask(lid, x, y, w, h):
    full = np.zeros((H, W), np.float32)
    m = mask_of(lid, w, h)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    full[y0:y1, x0:x1] = m[y0 - y:y1 - y, x0 - x:x1 - x]
    return full
def rect_cut(m, rects):
    m = m.copy()
    for x0, y0, x1, y1 in rects: m[y0:y1, x0:x1] = 0
    return m

h, s, v = hsv(V3)
def hue_in(lo, hi): lo /= 360; hi /= 360; return ((h >= lo) & (h <= hi)) if lo <= hi else ((h >= lo) | (h <= hi))
def soft(cond): return np.asarray(Image.fromarray((cond * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255

def variant(key, region, sel, fn, strength=0.85):
    m = np.asarray(Image.fromarray((np.clip(region, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32) / 255 * sel * strength
    nh, ns, nv = fn(h.copy(), s.copy(), v.copy())
    out = rgb_from(np.mod(nh, 1), np.clip(ns, 0, 1), np.clip(nv, 0, 1))
    alpha = (m * 255).astype(np.uint8)
    bb = Image.fromarray(alpha).getbbox()
    im = Image.fromarray(np.dstack([out, alpha]).astype(np.uint8), 'RGBA').crop(bb)
    im.save(f'{OUT}/{key}.webp', 'WEBP', quality=86, method=6)
    return {'key': f'scene/{key}', 'x': bb[0], 'y': bb[1], 'w': im.width, 'h': im.height}

def tint(key, region, mul, strength=0.9):
    m = np.asarray(Image.fromarray((np.clip(region, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255 * strength
    out = np.clip(V3 * np.array(mul, np.float32), 0, 255)
    alpha = (m * 255).astype(np.uint8)
    bb = Image.fromarray(alpha).getbbox()
    im = Image.fromarray(np.dstack([out, alpha]).astype(np.uint8), 'RGBA').crop(bb)
    im.save(f'{OUT}/{key}.webp', 'WEBP', quality=86, method=6)
    return {'key': f'scene/{key}', 'x': bb[0], 'y': bb[1], 'w': im.width, 'h': im.height}

TABLE = layer_mask('38-37', 630, 528, 225, 124)
notTable = 1 - np.asarray(Image.fromarray((TABLE * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))).astype(np.float32) / 255
SOFA = poly_mask([(420, 495), (430, 477), (490, 455), (565, 425), (635, 407), (680, 392), (720, 392), (780, 432), (797, 447), (790, 515), (700, 537), (635, 565), (610, 575), (520, 600), (500, 622), (462, 592), (440, 560)]) * notTable
DOG = poly_mask([(500, 585), (560, 610), (625, 660), (620, 720), (560, 722), (520, 660)])
# 벽: 거실 벽면만 (왼쪽 벽 + 창~주방 문 사이 뒷벽), 벽난로·창·커튼·그림·인물 제외
left = layer_mask('38-22', 120, 0, 372, 560); back = layer_mask('38-25', 605, 0, 395, 320); back[:, 828:] = 0
wall = np.maximum(left, back)
for poly in [[(200, 200), (445, 195), (470, 300), (470, 520), (200, 520)], [(245, 60), (380, 55), (385, 225), (245, 230)], [(425, 0), (690, 0), (690, 310), (425, 310)], [(530, 180), (770, 180), (770, 430), (530, 430)], [(360, 150), (420, 150), (420, 230), (360, 230)]]:
    wall = wall * (1 - poly_mask(poly))
wall_sel = soft(hue_in(15, 55) & (s > 0.06) & (s < 0.55) & (v > 0.3))
floor = layer_mask('38-97', 0, 245, 1536, 619) * (1 - SOFA) * (1 - DOG) * notTable
floor_sel = soft(hue_in(5, 38) & (s > 0.42) & (v > 0.15) & (v < 0.8))
sofa_sel = soft(hue_in(325, 22) & (s > 0.2) & (v > 0.1))
table_sel = soft(hue_in(0, 40) & (s > 0.25))
RUG = poly_mask([(300, 575), (790, 462), (1080, 607), (718, 812)]) * (1 - SOFA) * (1 - DOG) * notTable
rug = RUG * (1 - poly_mask([(265, 575), (470, 575), (470, 760), (265, 760)])) * (1 - poly_mask([(430, 630), (630, 630), (630, 870), (430, 870)]))
rug_sel = soft((hue_in(320, 40) & (s < 0.55) & (v > 0.35)))

ARM1 = poly_mask([(275, 590), (300, 580), (345, 584), (380, 600), (410, 612), (423, 640), (421, 712), (380, 722), (300, 722), (273, 700)]); ARM2 = np.clip(layer_mask('38-60', 428, 632, 200, 231) * 1.6, 0, 1)
PLANT = poly_mask([(300, 625), (345, 600), (405, 615), (420, 690), (395, 745), (325, 745), (298, 690)])
arm_sel = soft(hue_in(33, 80) & (s > 0.35) & (v > 0.06) & (v < 0.5))
CURT = poly_mask([(428, 20), (520, 20), (500, 300), (468, 300), (440, 260)]) + poly_mask([(575, 0), (640, 0), (668, 300), (600, 300), (590, 200)])
curt_sel = soft(hue_in(330, 25) & (s > 0.18) & (v > 0.12))
arm1_sel = soft(hue_in(20, 80) & (s > 0.4) & (v > 0.06) & (v < 0.3)) * (1 - PLANT * 0.4) + soft(hue_in(20, 80) & (s > 0.4) & (v >= 0.3) & (v < 0.72)) * (1 - PLANT)
arm = lambda key, region, fn: variant(key, region, arm_sel, fn, 0.9)
ROSE = lambda h, s, v: (h * 0 + 0.975, s * 0.62, np.minimum(1, v * 1.3))
BROWN = lambda h, s, v: (h * 0 + 0.055, s * 0.95, np.minimum(1, v * 1.3))

V = {
  # 벽: 무늬·질감은 그대로 두고 색만 입힘 (곱하기 틴트) → 칠한 회벽 느낌
  'B8': {'wp-mint': tint('var-B8-sage', wall, (0.80, 0.93, 0.78)), 'wp-damask': tint('var-B8-rose', wall, (1.0, 0.82, 0.80))},
  'B9': {'fl-tile': variant('var-B9-oak', floor, floor_sel, lambda h, s, v: (h + 0.015, s * 0.7, np.minimum(1, v * 1.3))),
         'fl-parquet': variant('var-B9-dark', floor, floor_sel, lambda h, s, v: (h - 0.01, s * 0.9, v * 0.68))},
  'C15': {'sofa-green': variant('var-C15-sage', SOFA, sofa_sel, lambda h, s, v: (h * 0 + 0.25, s * 0.42, v * 0.9)),
          'sofa-cloud': variant('var-C15-caramel', SOFA, sofa_sel, lambda h, s, v: (h * 0 + 0.075, s * 0.85, np.minimum(1, v * 1.15)))},
  'C16': {'arm-rose': variant('var-C16-rose', ARM1, arm1_sel, ROSE, 0.9), 'arm-brown': variant('var-C16-brown', ARM1, arm1_sel, BROWN, 0.9)},
  'C17': {'arm-rose': arm('var-C17-rose', ARM2, ROSE), 'arm-brown': arm('var-C17-brown', ARM2, BROWN)},
  'C18': {'table-marble': variant('var-C18-oak', TABLE, table_sel, lambda h, s, v: (h + 0.02, s * 0.75, np.minimum(1, v * 1.4))),
          'table-stump': variant('var-C18-ebony', TABLE, table_sel, lambda h, s, v: (h, s * 0.6, v * 0.55))},
  'D26': {'cur-ivory': variant('var-D26-ivory', CURT, curt_sel, lambda h, s, v: (h * 0 + 0.105, s * 0.42, np.minimum(1, v * 1.3 + 0.06))),
          'cur-olive': variant('var-D26-olive', CURT, curt_sel, lambda h, s, v: (h * 0 + 0.17, s * 0.5, v * 0.85))},
  'D27': {'rug-check': variant('var-D27-sage', rug, rug_sel, lambda h, s, v: (h * 0 + 0.24, s * 0.45, v)),
          'rug-lily': variant('var-D27-gold', rug, rug_sel, lambda h, s, v: (h * 0 + 0.11, s * 0.65, v))},
}
# 교체 전 상태(조명·장식 외): 테이블은 낡고 바랜 색, 러그는 빛바랜 색
pre_extra = [
  {**variant('pre-C18-worn', TABLE, table_sel, lambda h, s, v: (h, s * 0.45, v * 0.78)), 'task': 'C18'},
  {**variant('pre-D27-faded', rug, rug_sel, lambda h, s, v: (h, s * 0.35, v * 0.86)), 'task': 'D27'},
]
# 쌓는 순서: 나중 미션이 아래 — 렌더러가 미션 역순으로 그린다
scene = {'size': [W, H], 'base': 'scene/v3', 'layers': pre_extra + layers, 'variants': V}
# 2단계 오브젝트(소품·조명·패브릭·수리) 레이어·디자인 조각 추가
import sys; sys.path.insert(0, os.path.dirname(__file__)); import bake_objects; bake_objects.run(scene)
Image.fromarray(V3.astype(np.uint8)).save(f'{OUT}/v3.webp', 'WEBP', quality=90, method=6)
json.dump(scene, open(os.path.join(ROOT, 'src/game/mansion/scene.json'), 'w'), ensure_ascii=False, indent=1)
# 쓰지 않는 조각 파일 정리 (이전 굽기의 남은 파일)
used = {'v3'} | {l['key'].split('/')[1] for l in scene['layers']} | {p['key'].split('/')[1] for vs in scene['variants'].values() for p in vs.values()}
for f in os.listdir(OUT):
    if f[:-5] not in used: os.remove(os.path.join(OUT, f))
# manifest 등록 (scene/*) — 이전 scene/* 항목은 지우고 다시
for mp in ['src/game/manifest.json', 'public/assets/game/manifest.json']:
    mpath = os.path.join(ROOT, mp); doc = json.load(open(mpath))
    doc['items'] = {k: v for k, v in doc['items'].items() if not k.startswith('scene/')}
    json.dump(doc, open(mpath, 'w'), ensure_ascii=False, indent=1)
for mp in ['src/game/manifest.json', 'public/assets/game/manifest.json']:
    mpath = os.path.join(ROOT, mp); doc = json.load(open(mpath))
    for f in os.listdir(OUT):
        im = Image.open(os.path.join(OUT, f))
        doc['items']['scene/' + f[:-5]] = {'w': im.width, 'h': im.height, 'anchor': [im.width // 2, im.height // 2], 'sheet': '시안 A v3 · Figma 38:2 단계 레이어 (bake_scene.py)'}
    json.dump(doc, open(mpath, 'w'), ensure_ascii=False, indent=1)
# 미리보기: STEP 0 재현 확인
prev = Image.fromarray(V3.astype(np.uint8)).convert('RGBA')
order = sorted({l['task'] for l in scene['layers']}, key=lambda t: int(t[1:]), reverse=True)
for t in order:
    for L in [l for l in scene['layers'] if l['task'] == t]:
        prev.alpha_composite(Image.open(f"{OUT}/{L['key'].split('/')[1]}.webp").convert('RGBA'), (L['x'], L['y']))
prev.convert('RGB').save('/tmp/claude-0/-home-claude/77c19c0d-fa3d-5b32-b043-3a21ea98cb3e/scratchpad/scene-step0.jpg', quality=88)
err = np.abs(np.asarray(prev.convert('RGB')).astype(np.float32) - C[0]).mean()
print('layers', len(layers), 'variants', sum(len(v) for v in V.values()), 'step0 mean err', round(float(err), 2))
