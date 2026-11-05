"""
시안 A(Figma) 원본 → 게임 에셋 변환. 원본은 art/figma-a (수정하지 않음), 결과는 public/assets/game/a/*.webp + manifest.
- 마젠타 배경 시트: 키 제거(가장자리 번짐 보정) → 칸별 잘라 트림 → 발밑(또는 중심) 기준점
- 크림 배경 아이콘: 가장자리에서 배경색 영역만 투명 처리
- 텍스처: 칸 중앙을 잘라 상하좌우 반전 타일(이음매 없음)
- 캐릭터: 칸별 발끝 정렬 → 동작별 행으로 다시 배치 (src/game/mansion/sprites.json 갱신)
사용: python3 scripts/mansion-art/import_figma_a.py
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
SRC = os.path.join(ROOT, 'art/figma-a')
OUT = os.path.join(ROOT, 'public/assets/game/a')
MAN_OUT = os.path.join(ROOT, 'public/assets/game/mansion')
os.makedirs(OUT, exist_ok=True)
items = {}
sprites = {}

def key_magenta(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g
    alpha = np.clip((140 - m) / 80, 0, 1)
    spill = np.where(alpha < 1, np.clip(m - 20, 0, None), np.clip(m - 60, 0, None))
    a[..., 0] = r - spill * 0.9
    a[..., 2] = b - spill * 0.9
    a[..., 3] = a[..., 3] * alpha
    # 남은 마젠타 기운(잎 끝·거미줄의 분홍빛) 제거: min(R,B)-G 가 20 을 넘는 만큼 R·B 를 낮춤
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    ex = np.clip(np.minimum(r, b) - g - 20, 0, None)
    a[..., 0] -= ex; a[..., 2] -= ex
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

def drop_specks(im, frac=0.02):
    """이웃 칸에서 넘어온 작은 조각 제거 (가장 큰 덩어리의 frac 미만인 연결 영역)"""
    from scipy import ndimage
    a = np.asarray(im).copy()
    lab, n = ndimage.label(a[..., 3] > 24)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= sizes.max() * frac])
        a[..., 3] = np.where(keep | (a[..., 3] <= 24), a[..., 3], 0)
        a[..., 3] = np.where(lab > 0, np.where(keep, a[..., 3], 0), a[..., 3])
    return Image.fromarray(a, 'RGBA')

def key_cream(im, tol=26):
    """가장자리와 연결된 배경색 영역만 투명 (아이콘 내부의 밝은 색은 유지)"""
    a = np.asarray(im.convert('RGBA')).astype(np.int32)
    h, w = a.shape[:2]
    bg = np.median(np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]]), axis=0)
    close = (np.abs(a[..., :3] - bg).max(axis=2) < tol)
    mask = np.zeros((h, w), bool)
    stack = [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]
    while stack:
        y, x = stack.pop()
        if mask[y, x] or not close[y, x]: continue
        mask[y, x] = True
        if y > 0: stack.append((y - 1, x))
        if y < h - 1: stack.append((y + 1, x))
        if x > 0: stack.append((y, x - 1))
        if x < w - 1: stack.append((y, x + 1))
    alpha = Image.fromarray((~mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert('RGBA'); out.putalpha(alpha)
    return out

def trim(im, pad=4, thr=24):
    bb = im.getchannel('A').point(lambda v: 255 if v > thr else 0).getbbox()
    return im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))

def save(key, im, anchor='foot', sheet=''):
    path = os.path.join(ROOT, 'public/assets/game', key + '.webp')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=88, method=6)
    w, h = im.size
    items[key] = {'w': w, 'h': h, 'anchor': [w // 2, h // 2] if anchor == 'center' else [w // 2, h - 6], 'sheet': f'시안 A · {sheet}'}

def cells(name, cols, rows, keyer=key_magenta):
    im = keyer(Image.open(os.path.join(SRC, name)))
    cw, ch = im.width // cols, im.height // rows
    return [im.crop((i * cw, j * ch, (i + 1) * cw, (j + 1) * ch)) for j in range(rows) for i in range(cols)]

def sheet_objects(name, cols, rows, names, centers=(), note=''):
    for c, n in zip(cells(name, cols, rows), names):
        if n:
            c = drop_specks(c)
            if n == 'cobweb':  # 거미줄 실을 회백색으로
                g = c.convert('LA').convert('RGBA'); g.putalpha(c.getchannel('A')); c = g
            if n.startswith('plant-'):  # 잎 끝에 남은 분홍 기운 → 잎 색으로
                a = np.asarray(c).astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
                pink = (r > g + 8) & (b > g - 4) & (a[..., 3] > 0)
                lum = (r + g + b) / 3
                a[..., 0] = np.where(pink, lum * 0.78, r); a[..., 1] = np.where(pink, lum * 1.12, g); a[..., 2] = np.where(pink, lum * 0.62, b)
                c = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
            save(f'a/{n}', trim(c), 'center' if n in centers else 'foot', note)

sheet_objects('a-sheet-sofas-armchairs-tables.png', 4, 3,
  ['sofa-cream', 'sofa-green', 'sofa-red', 'sofa-covered', 'armchair-rose', 'armchair-green', 'armchair-leather', 'armchair-torn', 'table-oval', 'table-marble', 'table-lace', 'side-table'], note='Figma 33:9')
sheet_objects('a-lamps-shelves-rugs.png', 4, 3,
  ['lamp-shade', 'candelabra', 'lamp-tiffany', 'plant-fern', 'bookshelf-low', 'china-cabinet', 'bookshelf-tall', 'plant-palm', 'rug-rose', 'rug-green', 'rug-gold', 'rug-worn'],
  centers={'rug-rose', 'rug-green', 'rug-gold', 'rug-worn'}, note='Figma 33:10')
sheet_objects('a-architecture-3x2.png', 3, 2, ['fireplace-cold', 'fireplace-lit', 'window-curtain', 'door-double', 'painting', 'staircase'], centers={'window-curtain', 'painting'}, note='Figma 33:11')
sheet_objects('a-clutter-3x2.png', 3, 2, ['boxes', 'dust-pile', 'crate', 'leaves', 'cobweb', 'rolled-carpet'], centers={'leaves', 'cobweb'}, note='Figma 33:12')

# 아이콘 (크림 배경)
icon_names = ['quill', 'book', 'magnifier', 'armchair', 'gear', 'hammer', 'books', 'lock', 'seal', 'envelope', 'key', 'photo', 'scroll', 'candle', 'wall-scrap', 'duster', 'roller', 'sparkle']
for c, n in zip(cells('a-icons-cream-6x3.png', 6, 3, keyer=lambda x: x.convert('RGBA')), icon_names):
    save(f'a/icon-{n}', trim(drop_specks(key_cream(c), 0.12), pad=6), 'center', 'Figma 30:15')

# 텍스처 (상하좌우 반전 타일 → 이음매 없음)
tex_names = ['wall-worn', 'wall-damask-rose', 'wall-vine-green', 'wall-stripe-cream', 'floor-old-planks', 'floor-herringbone', 'floor-checker', 'floor-oak']
timg = Image.open(os.path.join(SRC, 'a-textures-4x2.png')).convert('RGB')
cw, ch = timg.width // 4, timg.height // 2
for k, n in enumerate(tex_names):
    i, j = k % 4, k // 4
    c = timg.crop((i * cw + 8, j * ch + 8, (i + 1) * cw - 8, (j + 1) * ch - 8))
    s = min(c.size); c = c.crop(((c.width - s) // 2, (c.height - s) // 2, (c.width + s) // 2, (c.height + s) // 2))
    t = Image.new('RGB', (s * 2, s * 2))
    t.paste(c, (0, 0)); t.paste(c.transpose(Image.FLIP_LEFT_RIGHT), (s, 0)); t.paste(c.transpose(Image.FLIP_TOP_BOTTOM), (0, s)); t.paste(c.transpose(Image.ROTATE_180), (s, s))
    t = t.resize((512, 512), Image.LANCZOS)
    save(f'a/{n}', t, 'center', 'Figma 30:11 (반전 타일)')
# 캐릭터: 발끝 정렬 후 동작 행으로 재배치
def char_sheet(key, name, cols, rows, actions, FW, FH, FOOT, note):
    cs = cells(name, cols, rows)
    ncol = max(len(v) for v in actions.values())
    out = Image.new('RGBA', (FW * ncol, FH * len(actions)), (0, 0, 0, 0))
    for r, (act, idx) in enumerate(actions.items()):
        for k, n in enumerate(idx):
            c = cs[n]
            bb = c.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
            part = c.crop((0, 0, c.width, bb[3]))
            out.alpha_composite(part, (k * FW + (FW - c.width) // 2, r * FH + FOOT - bb[3]))
    save(key, out, 'center', note)
    sprites[key] = {'frameW': FW, 'frameH': FH, 'cols': ncol, 'rows': [{'action': a, 'frames': len(v)} for a, v in actions.items()], 'foot': [FW // 2, FOOT]}

PERSON = {'idle': [0, 1], 'walk': [2, 3, 4, 5], 'sweep': [6, 7], 'repair': [8, 9], 'paint': [10, 11], 'celebrate': [13, 12, 13, 15]}
char_sheet('mansion/char-haru', 'a-heroine-4x4.png', 4, 4, PERSON, 256, 256, 248, 'Figma 33:6 하루')
char_sheet('mansion/char-aubrey', 'a-caretaker-4x4.png', 4, 4, {**PERSON, 'celebrate': [13, 12, 13, 15]}, 256, 256, 248, 'Figma 33:7 오브리')
char_sheet('mansion/char-hodu', 'sheet-puppy-poses-4x3-daylight.png', 4, 3, {'idle': [0, 1], 'walk': [2, 3, 4, 5], 'sniff': [7, 10, 7, 8], 'celebrate': [9, 1, 9, 6]}, 300, 300, 288, 'Figma 33:8 호두')

# 초상: 6×3 (하루 6 · 오브리 6 · 호두 3), 순서 = normal happy surprised suspicious worried thinking
pc = cells('a-portraits-6x3.png', 6, 3)
def portrait(key, idxs, exprs, note):
    frames = []
    for n in idxs:
        c = trim(pc[n], pad=2)
        s = max(c.size); sq = Image.new('RGBA', (s, s)); sq.alpha_composite(c, ((s - c.width) // 2, s - c.height))
        frames.append(sq.resize((420, 420), Image.LANCZOS))
    out = Image.new('RGBA', (420 * len(frames), 420))
    for i, f in enumerate(frames): out.alpha_composite(f, (i * 420, 0))
    save(key, out, 'center', note)
    sprites[key] = {'frameW': 420, 'frameH': 420, 'cols': len(frames), 'rows': [{'action': 'expressions', 'frames': len(frames)}], 'expressions': exprs, 'foot': [0, 0]}
EX = ['normal', 'happy', 'surprised', 'suspicious', 'worried', 'thinking']
portrait('mansion/portrait-haru', range(0, 6), EX, 'Figma 33:13 하루')
portrait('mansion/portrait-aubrey', range(6, 12), EX, 'Figma 33:13 오브리')
portrait('mansion/portrait-hodu', [12, 13, 14], ['normal', 'curious', 'happy'], 'Figma 33:13 호두')

sp_path = os.path.join(ROOT, 'src/game/mansion/sprites.json')
json.dump(sprites, open(sp_path, 'w'), ensure_ascii=False, indent=1)
for mp in ['src/game/manifest.json', 'public/assets/game/manifest.json']:
    p = os.path.join(ROOT, mp)
    doc = json.load(open(p))
    doc['items'].update(items)
    json.dump(doc, open(p, 'w'), ensure_ascii=False, indent=1)
print('assets', len(items), 'sheets', len(sprites))
