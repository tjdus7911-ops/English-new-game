"""
2단계 거실 오브젝트 굽기 — bake_scene.py 가 마지막에 호출한다 (단독 실행도 가능: scene.json 에 덧붙임).

시안 A v3 그림 위에서 각 작업(오브젝트)의 '이전 상태' 레이어와 디자인 3종 조각을 만든다.
- 교체형(소품·조명·패브릭): 원본(v3 그대로) + 새 디자인 2종. 새 디자인 조각 = 원본 자리 지우기(inpaint) + 새 스프라이트(같은 시점·빛으로 보정, 그림자)
- 추가형(거울·벽난로 장식·조각상): 빈자리에 새 디자인 3종
- 수리형(창틀·몰딩·난간): v3 를 가공해 만든 '고장 난' 이전 상태 레이어. 문은 같은 모양의 마감 색 3종
스프라이트 원본: art/figma-a/props/cut/*.png (Figma AI 시트 → cut_props.py)
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
CUT = os.path.join(ROOT, 'art/figma-a/props/cut')
OUT = os.path.join(ROOT, 'public/assets/game/scene')
W, H = 1536, 864
V3 = np.asarray(Image.open(os.path.join(ROOT, 'art/figma-a/a-v3-final.png')).convert('RGB')).astype(np.float32)
LUM = V3 @ np.array([0.299, 0.587, 0.114], np.float32)
WARM = np.array([1.0, 0.9, 0.74], np.float32)  # v3 의 따뜻한 저녁 빛


def sprite(name):
    return Image.open(os.path.join(CUT, name + '.png')).convert('RGBA')


def grade(im, ref_box, strength=1.0, gain=1.0):
    """스프라이트 색을 그 자리 주변 밝기·색감에 맞춤 (밝기 맞추기 + 따뜻한 빛 + 채도 약간 낮춤)"""
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3:] / 255
    x0, y0, x1, y1 = ref_box
    ref = V3[y0:y1, x0:x1]
    ref_l = (ref @ np.array([0.299, 0.587, 0.114])).mean()
    l = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    sl = (l[..., None] * al).sum() / max(1, al.sum())
    k = np.clip(ref_l / max(1, sl) * 1.12 * gain, 0.45, 1.05)
    out = rgb * k
    gray = out.mean(axis=2, keepdims=True)
    out = gray + (out - gray) * 0.88
    tint = ref.reshape(-1, 3).mean(0); tint = tint / tint.max()
    out = out * (WARM * 0.6 + tint * 0.4) ** strength
    a[..., :3] = np.clip(out, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def scaled(im, h=None, w=None, flip=False):
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if h: w2 = round(im.width * h / im.height); return im.resize((max(1, w2), h), Image.LANCZOS)
    h2 = round(im.height * w / im.width); return im.resize((w, max(1, h2)), Image.LANCZOS)


def shear(im, k):
    """벽면 기울기: x 가 1 늘 때 y 가 k 만큼 (벽난로 벽은 오른쪽이 올라감, k<0)"""
    pad = int(abs(k) * im.width) + 2
    big = Image.new('RGBA', (im.width, im.height + pad), (0, 0, 0, 0))
    big.paste(im, (0, pad if k < 0 else 0))
    # PIL affine: 출력 (x,y) ← 입력 (x, y + c*x + f)
    c = -k
    f = -pad if k < 0 else 0
    return big.transform(big.size, Image.AFFINE, (1, 0, 0, c, 1, f), Image.BICUBIC)


def to_quad(im, quad):
    """스프라이트를 장면 속 사각형(TL,TR,BR,BL)에 원근 맞춰 붙임 → 전체 크기 RGBA"""
    a = np.asarray(im).astype(np.float32)
    src = np.float32([[0, 0], [im.width, 0], [im.width, im.height], [0, im.height]])
    M = cv2.getPerspectiveTransform(src, np.float32(quad))
    out = cv2.warpPerspective(a, M, (W, H), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0))
    return np.clip(out, 0, 255)


BASE = V3  # 조각을 굽는 바탕 (의존 작업의 디자인이 적용된 v3)


class Canvas:
    def __init__(self):
        self.base = BASE
        self.rgb = BASE.copy()
        self.touch = np.zeros((H, W), np.float32)  # 바뀐 곳 (조각 알파)

    def erase(self, rects=(), polys=(), radius=6):
        m = np.zeros((H, W), np.uint8)
        for x0, y0, x1, y1 in rects: m[y0:y1, x0:x1] = 255
        if polys:
            im = Image.fromarray(m); d = ImageDraw.Draw(im)
            for p in polys: d.polygon(p, fill=255)
            m = np.asarray(im).copy()
        if not m.any(): return
        self.rgb = cv2.inpaint(np.clip(self.rgb, 0, 255).astype(np.uint8), m, radius, cv2.INPAINT_TELEA).astype(np.float32)
        soft = cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 1.5)
        self.touch = np.maximum(self.touch, np.clip(soft * 1.6, 0, 1))

    def over(self, full_rgba, shadow=None):
        """full_rgba: 장면 크기 RGBA 배열"""
        al = full_rgba[..., 3:] / 255
        self.rgb = self.rgb * (1 - al) + full_rgba[..., :3] * al
        self.touch = np.maximum(self.touch, al[..., 0])

    def place(self, im, foot=None, center=None, shadow=True, shadow_w=0.8):
        """foot: 바닥에 닿는 아래 가운데 / center: 벽에 거는 물건의 가운데"""
        full = np.zeros((H, W, 4), np.float32)
        if foot: x, y = round(foot[0] - im.width / 2), round(foot[1] - im.height)
        else: x, y = round(center[0] - im.width / 2), round(center[1] - im.height / 2)
        if shadow:
            sh = np.zeros((H, W), np.uint8)
            if foot:
                cv2.ellipse(sh, (int(foot[0]), int(foot[1]) - 1), (max(2, int(im.width * shadow_w / 2)), max(2, int(im.width * 0.12))), 0, 0, 360, 255, -1)
                sh = cv2.GaussianBlur(sh.astype(np.float32), (0, 0), max(1.5, im.width * 0.05)) / 255 * 0.5
            else:  # 벽에 드리운 그림자: 오른쪽 아래로 살짝
                a = np.zeros((H, W), np.float32); self._paste_alpha(a, im, x + 3, y + 4)
                sh = cv2.GaussianBlur(a, (0, 0), 3) * 0.45
            self.rgb = self.rgb * (1 - sh[..., None] * 0.75) + np.array([40, 24, 12], np.float32) * sh[..., None] * 0.75
            self.touch = np.maximum(self.touch, np.clip(sh * 2.5, 0, 1))
        self._paste(full, im, x, y)
        self.over(full)

    @staticmethod
    def _paste(full, im, x, y):
        a = np.asarray(im).astype(np.float32)
        h, w = a.shape[:2]
        X0, Y0, X1, Y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if X1 <= X0 or Y1 <= Y0: return
        full[Y0:Y1, X0:X1] = a[Y0 - y:Y1 - y, X0 - x:X1 - x]

    @staticmethod
    def _paste_alpha(arr, im, x, y):
        a = np.asarray(im)[..., 3].astype(np.float32) / 255
        h, w = a.shape
        X0, Y0, X1, Y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if X1 > X0 and Y1 > Y0: arr[Y0:Y1, X0:X1] = np.maximum(arr[Y0:Y1, X0:X1], a[Y0 - y:Y1 - y, X0 - x:X1 - x])

    def restore(self, poly):
        """v3 원본 픽셀을 다시 위에 (예: 꽃만 바꾸고 화병은 그대로)"""
        im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon(poly, fill=255)
        m = np.asarray(im.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)[..., None] / 255
        self.rgb = self.rgb * (1 - m) + self.base * m

    def save(self, key):
        alpha = np.clip(self.touch, 0, 1)
        diff = np.abs(self.rgb - self.base).max(axis=2)
        alpha = alpha * np.clip(diff / 4, 0, 1)
        a8 = (alpha * 255).astype(np.uint8)
        bb = Image.fromarray(a8).getbbox()
        im = Image.fromarray(np.dstack([np.clip(self.rgb, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA').crop(bb)
        im.save(f'{OUT}/{key}.webp', 'WEBP', quality=88, method=6)
        return {'key': f'scene/{key}', 'x': bb[0], 'y': bb[1], 'w': im.width, 'h': im.height}


def region_proc(key, poly, fn, feather=2.0):
    """v3 의 한 영역을 가공한 이전 상태 레이어 (fn: rgb 배열 → rgb 배열)"""
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im)
    for p in poly: ImageDraw.Draw(im).polygon(p, fill=255)
    m = np.asarray(im.filter(ImageFilter.GaussianBlur(feather))).astype(np.float32) / 255
    out = np.clip(fn(V3.copy()), 0, 255)
    c = Canvas(); c.rgb = out; c.touch = m
    return c.save(key)


def dusty(rgb, amt=1.0):
    """먼지 쌓이고 빛바랜 낡은 상태: 채도↓ 밝기↓ 회색 먼지막"""
    g = rgb.mean(axis=2, keepdims=True)
    out = g + (rgb - g) * (1 - 0.6 * amt)
    out = out * (1 - 0.22 * amt) + np.array([150, 140, 125], np.float32) * 0.12 * amt
    return out


rng = np.random.default_rng(7)


def cracks(rgb, region, n=6, color=(45, 30, 20)):
    """가는 금 (어두운 꺾은선)"""
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = region
    for _ in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        pts = [(x, y)]
        for _ in range(rng.integers(3, 6)):
            x += rng.uniform(-9, 9); y += rng.uniform(2, 10); pts.append((x, y))
        d.line(pts, fill=color, width=1)
    return np.asarray(im).astype(np.float32)


# ─────────────────────────────── 작업별 정의 ───────────────────────────────
K_MANTEL = -0.37  # 벽난로 벽 기울기


# 바탕이 다른 작업의 디자인에 따라 달라지는 오브젝트 (벽 색·테이블·안락의자 위에 놓이거나 겹치는 것)
# → 바탕 작업 디자인 조합마다 따로 굽는다. 조각 키: '<디자인>' (바탕 모두 원본) / '<디자인>@<바탕1 디자인>+<바탕2 디자인>' (원본은 '_')
DEP = {'D24': ['B8'], 'E29': ['B8'], 'E31': ['B8'], 'E37': ['B8'], 'E35': ['C18'], 'E39': ['C18'],
       'C19': ['C16'], 'E34': ['C16', 'C19']}


def load_piece(piece):
    return Image.open(os.path.join(ROOT, 'public/assets/game', piece['key'] + '.webp')).convert('RGBA')


def build(scene):
    global BASE
    layers, variants = [], {}
    allv = lambda: {**scene['variants'], **variants}

    def base_ids(task):
        return [k for k in allv().get(task, {}) if '@' not in k]

    def resolve(task, vid, choice):
        """task 의 디자인 vid 조각 — 그 task 도 바탕에 따라 구운 조각이 있으면 현재 조합에 맞는 것"""
        vs = allv()[task]
        deps = DEP.get(task, [])
        if deps:
            parts = [choice.get(d, '_') for d in deps]
            if any(p != '_' for p in parts) and f"{vid}@{'+'.join(parts)}" in vs: return vs[f"{vid}@{'+'.join(parts)}"]
        return vs[vid]

    def bases(task):
        from itertools import product
        deps = DEP.get(task, [])
        for combo in product(*[['_'] + base_ids(d) for d in deps]):
            choice = dict(zip(deps, combo))
            if all(c == '_' for c in combo):
                yield '', V3; continue
            im = Image.fromarray(V3.astype(np.uint8)).convert('RGBA')
            for d in deps:
                if choice[d] == '_': continue
                pc = resolve(d, choice[d], choice)
                im.alpha_composite(load_piece(pc), (pc['x'], pc['y']))
            yield '@' + '+'.join(combo), np.asarray(im.convert('RGB')).astype(np.float32)

    def replace(task, keys, erase_rects=(), erase_polys=(), put=None, pre=None):
        """교체형: 원본(v3 그대로) + 새 디자인 (keys: [(variant_id, sprite)])"""
        global BASE
        variants[task] = {}
        for suf, base in bases(task):
            BASE = base
            for vid, name in keys:
                c = Canvas(); c.erase(erase_rects, erase_polys)
                put(c, name)
                variants[task][vid + suf] = c.save(f'var-{task}-{vid}{suf.replace("@", "-on-").replace("+", "-")}')
        BASE = V3
        if pre: layers.append({**pre, 'task': task})

    def add(task, keys, put):
        global BASE
        variants[task] = {}
        for suf, base in bases(task):
            BASE = base
            for vid, name in keys:
                c = Canvas(); put(c, name); variants[task][vid + suf] = c.save(f'var-{task}-{vid}{suf.replace("@", "-on-").replace("+", "-")}')
        BASE = V3

    def dusty_pre(task, polys, amt=1.0, fn=None):
        """낡은 소품: 사각형 안에서 '배경과 다른 픽셀'(= 물건)만 골라 먼지·빛바램 처리"""
        im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
        for p in polys: d.polygon(p, fill=255)
        m = np.asarray(im).copy()
        bg = cv2.inpaint(V3.astype(np.uint8), m, 6, cv2.INPAINT_TELEA).astype(np.float32)
        obj = np.clip((np.abs(V3 - bg).max(axis=2) - 10) / 25, 0, 1) * (m > 0)
        obj = cv2.GaussianBlur(cv2.dilate(obj, np.ones((3, 3), np.uint8)), (0, 0), 1.0)
        c = Canvas(); c.rgb = np.clip((fn or (lambda r: dusty(r, amt)))(V3.copy()), 0, 255); c.touch = obj
        return c.save(f'pre-{task}-dusty')

    rect = lambda x0, y0, x1, y1: [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

    # E30 탁상시계 (벽난로 위)
    replace('E30', [('clock-gilt', 'clock-gilt'), ('clock-porcelain', 'clock-porcelain')], erase_rects=[(311, 205, 350, 250)],
            put=lambda c, n: c.place(grade(scaled(sprite(n), h=42), (290, 200, 370, 260)), foot=(331, 248)),
            pre=dusty_pre('E30', [rect(311, 205, 350, 250)]))
    # E36 촛대
    replace('E36', [('candle-silver', 'candle-silver'), ('candle-wood', 'candle-wood')], erase_rects=[(237, 222, 251, 271), (255, 231, 274, 271)],
            put=lambda c, n: c.place(grade(scaled(sprite(n), h=46), (225, 220, 290, 280), gain=1.1), foot=(255, 270), shadow_w=0.6),
            pre=dusty_pre('E36', [rect(237, 222, 251, 271), rect(255, 231, 274, 271)]))
    # E31 화병 (벽난로 위 꽃병 → 다른 화병)
    replace('E31', [('vase-porcelain', 'vase-porcelain'), ('vase-brass', 'vase-brass')], erase_rects=[(364, 146, 416, 219)],
            put=lambda c, n: c.place(grade(scaled(sprite(n), h=50), (350, 160, 430, 230)), foot=(391, 218), shadow_w=0.7),
            pre=dusty_pre('E31', [rect(364, 146, 416, 219)]))
    # E38 벽난로 위 장식품 (추가형: 촛대와 시계 사이)
    add('E38', [('orn-globe', 'orn-globe'), ('orn-urns', 'orn-urns'), ('orn-foodog', 'orn-foodog')],
        put=lambda c, n: c.place(grade(scaled(sprite(n), h=34 if n != 'orn-foodog' else 28), (275, 220, 315, 265)), foot=(294, 260), shadow_w=0.7))
    # E29 벽 액자 (벽난로 위, 벽 원근에 맞춤)
    FRAME = [(249, 107), (373, 63), (373, 180), (251, 229)]
    def frame(c, n):
        g = grade(sprite(n), (240, 60, 380, 230), gain=0.95)
        sh = to_quad(g, [(x + 3, y + 5) for x, y in FRAME]); sha = cv2.GaussianBlur(sh[..., 3] / 255, (0, 0), 3) * 0.4
        c.rgb = c.rgb * (1 - sha[..., None] * 0.7) + np.array([40, 24, 12]) * sha[..., None] * 0.7; c.touch = np.maximum(c.touch, sha * 2)
        c.over(to_quad(g, FRAME))
    replace('E29', [('frame-roses', 'frame-roses'), ('frame-ship', 'frame-ship')], put=frame)
    layers.append({**dusty_pre('E29', [FRAME], 0.8), 'task': 'E29'})  # 액자 테두리·그림만
    # D24 벽등 2개 (벽난로 양옆)
    def sconces(c, n):
        s = grade(sprite(n), (190, 90, 450, 250), gain=1.15)
        c.place(shear(scaled(s, h=72), K_MANTEL * 0.6), center=(229, 206))
        c.place(shear(scaled(s, h=58), K_MANTEL * 0.6), center=(418, 124))
    replace('D24', [('sconce-iron', 'sconce-iron'), ('sconce-tulip', 'sconce-tulip')], erase_rects=[(199, 165, 257, 230), (387, 91, 448, 155)], put=sconces,
            pre=dusty_pre('D24', [rect(199, 165, 257, 250), rect(387, 91, 448, 155)], fn=lambda r: r * np.array([0.55, 0.5, 0.48]) + 6))
    # E35 책 장식 (커피 테이블)
    replace('E35', [('books-glass', 'books-glass'), ('books-ends', 'books-ends')], erase_rects=[(665, 556, 740, 617)],
            put=lambda c, n: c.place(grade(scaled(sprite(n), w=68), (650, 560, 760, 630)), foot=(702, 614)),
            pre=dusty_pre('E35', [rect(665, 556, 740, 617)]))
    # E32 꽃 장식 (커피 테이블 화병의 꽃만 교체, 화병은 원본)
    VASE = [(739, 556), (745, 552), (764, 552), (770, 557), (771, 575), (766, 588), (742, 588), (737, 575)]
    def flowers(c, n):
        s = sprite(n); s = s.crop((0, 0, s.width, int(s.height * 0.78)))
        c.place(grade(scaled(s, w=74), (700, 500, 800, 580), gain=1.05), foot=(754, 566), shadow=False)
        c.restore(VASE)
    replace('E32', [('flower-lilies', 'flower-lilies'), ('flower-wild', 'flower-wild')], put=flowers,  # 지우지 않고 덮음 → 뒤 소파 색과 무관
            pre=dusty_pre('E32', [rect(721, 506, 788, 557)], fn=lambda r: dusty(r, 1.2) * np.array([1.0, 0.9, 0.72])))
    # E40 테이블 장식품 (앞쪽 작은 원탁)
    replace('E40', [('tray-tea', 'tray-tea'), ('tray-apples', 'tray-apples')], erase_rects=[(623, 757, 694, 811)],
            put=lambda c, n: c.place(grade(scaled(sprite(n), w=66), (600, 750, 710, 830)), foot=(658, 806)),
            pre=dusty_pre('E40', [rect(623, 757, 694, 811)]))
    # E39 작은 조각상 (추가형: 커피 테이블 왼쪽 끝)
    add('E39', [('statue-bust', 'statue-bust'), ('statue-horse', 'statue-horse'), ('statue-shepherdess', 'statue-shepherdess')],
        put=lambda c, n: c.place(grade(scaled(sprite(n), h=40 if n != 'statue-horse' else 34), (630, 570, 690, 630)), foot=(652, 604), shadow_w=0.7))
    # E37 거울 (추가형: 책장과 주방 문 사이 벽)
    add('E37', [('mirror-oval', 'mirror-oval'), ('mirror-walnut', 'mirror-walnut'), ('mirror-sun', 'mirror-sun')],
        put=lambda c, n: c.place(grade(scaled(sprite(n), h=86 if n != 'mirror-sun' else 62), (760, 10, 805, 130), gain=1.05), center=(781, 70)))
    # D28 소파 쿠션 2개 (덮어서 교체)
    def cushions(c, n):
        s = sprite(n)
        c.place(grade(scaled(s, w=62).rotate(-8, expand=True, resample=Image.BICUBIC), (490, 470, 560, 545)), center=(524, 510), shadow=False)
        c.place(grade(scaled(s, w=66, flip=True).rotate(6, expand=True, resample=Image.BICUBIC), (660, 415, 735, 485)), center=(699, 450), shadow=False)
    replace('D28', [('cushion-rose', 'cushion-rose'), ('cushion-sage', 'cushion-sage')], put=cushions,
            pre=dusty_pre('D28', [rect(496, 476, 553, 542), rect(667, 418, 731, 482)], 1.1))
    # ── 가구 교체 (겹치는 앞쪽 물건은 원본 픽셀을 다시 위에 올려 자연스럽게) ──
    def obj_layer(polys):
        """v3 에서 물건만 오려 낸 RGBA (배경과 다른 픽셀 = 물건)"""
        im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
        for p in polys: d.polygon(p, fill=255)
        m = np.asarray(im).copy()
        bg = cv2.inpaint(V3.astype(np.uint8), m, 6, cv2.INPAINT_TELEA).astype(np.float32)
        obj = np.clip((np.abs(V3 - bg).max(axis=2) - 8) / 20, 0, 1) * (m > 0)
        obj = cv2.GaussianBlur(obj, (0, 0), 0.7)
        return np.dstack([V3, obj * 255])
    # C19 사이드 테이블: 램프·책은 그대로 새 테이블 위로, 앞의 안락의자·화분은 다시 앞에
    LAMP = [(354, 503), (414, 503), (416, 552), (403, 562), (404, 602), (366, 602), (370, 562), (352, 550)]
    BOOKS = [(404, 566), (446, 562), (450, 596), (408, 601)]
    lamp_books = obj_layer([LAMP, BOOKS])
    ARM1_FRONT = [(268, 590), (300, 578), (338, 588), (368, 610), (372, 650), (360, 700), (300, 745), (268, 700)]
    PLANT_FRONT = [(300, 620), (330, 598), (395, 600), (422, 640), (418, 700), (390, 745), (330, 745), (298, 700)]
    TOP = {'stable-mahogany': (118, 150), 'stable-marble': (102, 140)}  # 상판 아래쪽 y(원본 px), 표시 너비
    def short_table(n):
        """v3 의 낮은 사이드 테이블 높이에 맞춰 다리만 줄임 (상판 모양은 그대로)"""
        im = sprite(n); cut, w = TOP[n]
        top, legs = im.crop((0, 0, im.width, cut)), im.crop((0, cut, im.width, im.height))
        k = w / im.width
        top = top.resize((w, round(cut * k)), Image.LANCZOS)
        legs = legs.resize((w, 76), Image.LANCZOS)
        out = Image.new('RGBA', (w, top.height + legs.height), (0, 0, 0, 0)); out.paste(legs, (0, top.height)); out.alpha_composite(top, (0, 0))
        return out
    def side_table(c, n):
        t = short_table(n)
        c.place(grade(t, (330, 540, 500, 670)), foot=(405, 690), shadow_w=0.75)
        c.over(lamp_books)
        c.restore(ARM1_FRONT); c.restore(PLANT_FRONT)
    replace('C19', [('stable-mahogany', 'stable-mahogany'), ('stable-marble', 'stable-marble')],
            erase_polys=[[(332, 552), (420, 545), (470, 548), (496, 572), (492, 668), (332, 668)], LAMP, BOOKS], put=side_table,
            pre=dusty_pre('C19', [[(332, 552), (470, 548), (496, 572), (492, 668), (372, 668), (372, 610)]], 0.9))
    # C20 수납장 (책장 자리, 앞의 오브리는 다시 앞에)
    AUBREY = [(686, 252), (688, 214), (703, 199), (727, 199), (740, 214), (744, 240), (748, 252)]
    def storage(c, n):
        c.place(grade(scaled(sprite(n), h=262), (690, 20, 770, 240), gain=0.95), foot=(731, 250), shadow_w=0.9)
        c.restore(AUBREY)
    replace('C20', [('tall-bookcase', 'tall-bookcase'), ('tall-cupboard', 'tall-cupboard')], erase_rects=[(694, 0, 770, 252)], put=storage,
            pre=dusty_pre('C20', [rect(694, 0, 770, 200)], 0.9))
    # C21 장식장 (주방 문 옆 박스 더미 자리, 천 덮인 의자는 다시 앞에)
    COVERED = [(920, 422), (928, 292), (974, 255), (1062, 255), (1096, 300), (1102, 418), (1086, 442), (1020, 462), (944, 447)]
    def cabinet(c, n):
        c.place(grade(scaled(sprite(n), h=190), (860, 200, 1000, 400), gain=0.95), foot=(935, 386), shadow_w=0.9)
        c.restore(COVERED)
    add('C21', [('disp-walnut', 'disp-walnut'), ('disp-white', 'disp-white'), ('disp-oak', 'disp-oak')],
        put=lambda c, n: (c.erase(polys=[[(872, 262), (930, 255), (992, 270), (994, 392), (872, 392)]]), cabinet(c, n)))
    # C22 콘솔 테이블 (복도, 앞의 벤치는 다시 앞에)
    BENCH = [(1346, 236), (1430, 196), (1464, 211), (1464, 246), (1386, 296), (1344, 290)]
    def console(c, n):
        c.place(grade(scaled(sprite(n), w=158), (1300, 110, 1470, 300)), foot=(1388, 302), shadow_w=0.8)
        c.restore(BENCH)
    replace('C22', [('console-gilt', 'console-gilt'), ('console-cream', 'console-cream')],
            erase_polys=[[(1306, 178), (1460, 132), (1470, 150), (1466, 302), (1306, 302)], rect(1330, 115, 1350, 182), rect(1360, 108, 1400, 176), rect(1410, 96, 1430, 150)],
            put=console, pre=dusty_pre('C22', [[(1306, 178), (1460, 132), (1470, 150), (1466, 302), (1306, 302)]], 0.8))

    # E34 앞쪽 화분 교체
    PLANT2 = [(300, 620), (330, 598), (395, 600), (422, 640), (418, 700), (390, 745), (330, 745), (298, 700)]
    replace('E34', [('plant-fig', 'plant-fig'), ('plant-topiary', 'plant-topiary')], erase_polys=[PLANT2],
            put=lambda c, n: c.place(grade(scaled(sprite(n), h=150 if n == 'plant-fig' else 128), (280, 590, 440, 760)), foot=(361, 746)),
            pre=dusty_pre('E34', [PLANT2], fn=lambda r: dusty(r, 1.0) * np.array([1.0, 0.88, 0.66])))

    # ── 수리형 ──
    # B10 창틀: 때 묻고 금 간 창틀
    WIN = [(495, 12), (604, 12), (604, 258), (495, 258)]
    def win_old(r):
        x = r * np.array([0.82, 0.78, 0.7])
        return cracks(x, (500, 20, 600, 250), n=12)
    layers.append({**region_proc('pre-B10-frame', [WIN], win_old), 'task': 'B10'})
    # B11 천장 몰딩: 벽 위쪽 띠가 어둡게 갈라짐
    MOLD = [[(118, 98), (330, 0), (352, 0), (122, 120)], [(605, 0), (1000, 0), (1000, 9), (605, 9)]]
    def mold_old(r):
        x = r * np.array([0.72, 0.68, 0.62])
        for reg in [(130, 10, 340, 110), (610, 0, 990, 14)]: x = cracks(x, reg, n=10)
        return x
    layers.append({**region_proc('pre-B11-molding', MOLD, mold_old, 1.2), 'task': 'B11'})
    # B13 계단 난간: 난간살 3개 빠지고 하나는 바닥에 떨어짐
    c = Canvas()
    BAL = [(1339, 421, 1353, 508), (1400, 328, 1414, 422), (1458, 266, 1472, 358)]
    piece_src = Image.fromarray(V3.astype(np.uint8)).crop(BAL[0]).convert('RGBA')
    c.erase(rects=BAL, radius=4)
    fallen = grade(piece_src.rotate(78, expand=True, resample=Image.BICUBIC), (1260, 560, 1330, 620), strength=0)
    c.place(fallen, foot=(1296, 612), shadow_w=0.9)
    c.rgb = np.where(c.touch[..., None] > 0, c.rgb, c.rgb)
    layers.append({**c.save('pre-B13-rail'), 'task': 'B13'})
    # B14 정원 문: 같은 문의 마감 색 3종 (원본 세이지 + 아이보리 + 월넛), 이전 상태는 낡은 문
    DOOR = [(0, 232), (70, 232), (120, 262), (136, 300), (136, 610), (0, 610)]
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon(DOOR, fill=255)
    dm = np.asarray(im).astype(np.float32) / 255
    f = V3 / 255; mx, mn = f.max(2), f.min(2); s = (mx - mn) / (mx + 1e-6)
    hue_ok = ((f[..., 1] >= f[..., 0] - 0.02) & (f[..., 1] >= f[..., 2] - 0.02)) | (s < 0.12)
    sel = (s < 0.32) & (mx > 0.28) & hue_ok
    sel = cv2.GaussianBlur((sel * dm).astype(np.float32), (0, 0), 1.0)
    def door_var(key, fn):
        c = Canvas(); out = fn(V3.copy())
        c.rgb = V3 * (1 - sel[..., None]) + out * sel[..., None]; c.touch = sel
        return c.save(key)
    gl = LUM[..., None]
    variants['B14'] = {
        'door-ivory': door_var('var-B14-ivory', lambda r: gl * np.array([1.18, 1.1, 0.95]) + 18),
        'door-walnut': door_var('var-B14-walnut', lambda r: gl * np.array([0.9, 0.58, 0.36])),
    }
    layers.append({**door_var('pre-B14-old', lambda r: cracks(dusty(r, 1.4) * np.array([0.85, 0.82, 0.74]), (10, 300, 125, 600), n=10)), 'task': 'B14'})
    return layers, variants


def run(scene):
    layers, variants = build(scene)
    scene['layers'] = layers + scene['layers']
    scene['variants'].update(variants)
    scene['deps'] = DEP
    return scene


if __name__ == '__main__':
    import json
    p = os.path.join(ROOT, 'src/game/mansion/scene.json')
    sc = json.load(open(p))
    sc['layers'] = [l for l in sc['layers'] if not any(l['key'].startswith(f'scene/pre-{t}-') for t in ['B10', 'B11', 'B13', 'B14', 'D24', 'D28', 'E29', 'E30', 'E31', 'E32', 'E34', 'E35', 'E36', 'E40'])]
    run(sc)
    json.dump(sc, open(p, 'w'), ensure_ascii=False, indent=1)
    print('layers', len(sc['layers']), 'variants', sum(len(v) for v in sc['variants'].values()))
