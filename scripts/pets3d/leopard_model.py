"""
설표(ice_leopard) 1단계 3D 모델 + 뼈대 (Blender bpy, 코드로 모델링).
- 한 장의 스킨 메시(부드러운 둥근 파츠를 합침) + 정점 색(무늬·눈·귀·코) + 3D 뼈대 가중치.
- 앞쪽 = -Y, 위 = +Z. (glTF 로 내보내면 앞 = +Z, 위 = +Y)
공용 함수: build() -> (mesh_obj, armature_obj)
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------- 색 (sRGB 눈대중 → 선형으로 변환해서 저장)
WHITE = np.array([0.94, 0.96, 1.00])
FUR_SHADE = np.array([0.80, 0.86, 0.97])
SPOT = np.array([0.30, 0.38, 0.60])
SPOT_IN = np.array([0.66, 0.73, 0.90])
EAR_OUT = np.array([0.20, 0.23, 0.34])
EAR_IN = np.array([0.93, 0.66, 0.72])
NOSE = np.array([0.90, 0.52, 0.58])
IRIS = np.array([0.10, 0.45, 0.95])
IRIS_LIGHT = np.array([0.45, 0.78, 1.0])
PUPIL = np.array([0.02, 0.03, 0.10])
SCLERA = np.array([0.98, 0.98, 1.0])
LID = np.array([0.12, 0.13, 0.22])
TAIL_BASE = np.array([0.55, 0.62, 0.80])
TAIL_DARK = np.array([0.27, 0.33, 0.52])
PAW = np.array([0.97, 0.98, 1.0])


def lin(c):
    return np.clip(c, 0, 1) ** 2.2


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- 파츠 정의
# (이름, 가중 뼈대 후보, 중심, 반지름(x,y,z), 오일러 회전, 종류, 세분화)
def P(name, bones, c, r, rot=(0, 0, 0), kind='fur', sub=4):
    return dict(name=name, bones=bones, c=Vector(c), r=Vector(r), rot=rot, kind=kind, sub=sub)


def parts():
    L = []
    # 몸통
    L += [P('hips', ['hips', 'spine'], (0, 0.28, 0.55), (0.31, 0.31, 0.275)),
          P('mid', ['spine', 'hips', 'chest'], (0, 0.02, 0.55), (0.32, 0.34, 0.275)),
          P('chest', ['chest', 'spine'], (0, -0.28, 0.57), (0.32, 0.31, 0.29)),
          P('neckfluff', ['chest', 'neck', 'head'], (0, -0.50, 0.64), (0.25, 0.20, 0.24))]
    # 머리
    L += [P('head', ['head'], (0, -0.62, 0.93), (0.42, 0.36, 0.37), sub=5),
          P('cheek_l', ['head'], (0.25, -0.70, 0.82), (0.13, 0.12, 0.11), kind='cheek'),
          P('cheek_r', ['head'], (-0.25, -0.70, 0.82), (0.13, 0.12, 0.11), kind='cheek'),
          P('muzzle', ['head'], (0, -0.945, 0.83), (0.13, 0.09, 0.08), kind='muzzle'),
          P('nose', ['head'], (0, -1.02, 0.865), (0.048, 0.03, 0.032), kind='nose', sub=3)]
    # 눈 (눈 뼈대: 깜빡임)
    for s, b in ((1, 'eye_l'), (-1, 'eye_r')):
        L.append(P('eye' + b[-2:], [b], (0.178 * s, -0.925, 0.945), (0.108, 0.07, 0.118), kind='eye', sub=5))
    # 귀
    for s, b in ((1, 'ear_l'), (-1, 'ear_r')):
        L.append(P('ear' + b[-2:], [b], (0.27 * s, -0.55, 1.28), (0.17, 0.06, 0.19), rot=(0.1, -0.42 * s, 0.0), kind='ear', sub=4))
    # 앞다리
    for s, sd in ((1, 'l'), (-1, 'r')):
        x = 0.18 * s
        L += [P(f'f_up_{sd}', [f'f_up_{sd}', f'f_lo_{sd}', 'chest'], (x, -0.31, 0.34), (0.125, 0.13, 0.175)),
              P(f'f_lo_{sd}', [f'f_lo_{sd}', f'f_up_{sd}'], (x, -0.32, 0.17), (0.105, 0.11, 0.13)),
              P(f'f_paw_{sd}', [f'f_lo_{sd}'], (x, -0.355, 0.07), (0.115, 0.14, 0.078), kind='paw')]
    # 뒷다리
    for s, sd in ((1, 'l'), (-1, 'r')):
        x = 0.21 * s
        L += [P(f'h_up_{sd}', [f'h_up_{sd}', f'h_lo_{sd}', 'hips'], (x, 0.31, 0.38), (0.165, 0.18, 0.205)),
              P(f'h_lo_{sd}', [f'h_lo_{sd}', f'h_up_{sd}'], (x, 0.30, 0.17), (0.10, 0.11, 0.13)),
              P(f'h_paw_{sd}', [f'h_lo_{sd}'], (x, 0.26, 0.07), (0.115, 0.145, 0.078), kind='paw')]
    # 꼬리 (굵고 풍성) — 점점 가늘어짐
    path = [(0, 0.50, 0.58), (0, 0.72, 0.64), (0, 0.90, 0.78), (0, 1.00, 0.98), (0, 0.98, 1.18), (0, 0.90, 1.34)]
    NT = 26
    for k in range(NT):
        t = k / (NT - 1) * 5
        i = min(int(t), 4)
        f = t - i
        a, b = path[i], path[i + 1]
        c = tuple(a[j] * (1 - f) + b[j] * f for j in range(3))
        r = 0.125 - 0.025 * (k / (NT - 1)) + 0.012 * math.sin(k / (NT - 1) * math.pi)
        bi = i + 1
        other = bi - 1 if f < 0.5 and bi > 1 else min(bi + 1, 5)
        L.append(P(f'tail{k + 1:02d}', [f'tail{bi}', f'tail{other}'], c, (r * 1.0, r * 1.05, r * 1.05), kind='tail', sub=3))
    return L


# ---------------------------------------------------------------- 뼈대 정의 (이름: 머리, 꼬리, 부모)
def skeleton():
    B = {}
    B['root'] = ((0, 0.3, 0.0), (0, 0.3, 0.12), None)
    B['hips'] = ((0, 0.32, 0.5), (0, 0.10, 0.5), 'root')
    B['spine'] = ((0, 0.10, 0.5), (0, -0.22, 0.53), 'hips')
    B['chest'] = ((0, -0.22, 0.53), (0, -0.42, 0.60), 'spine')
    B['neck'] = ((0, -0.42, 0.60), (0, -0.56, 0.84), 'chest')
    B['head'] = ((0, -0.56, 0.84), (0, -0.90, 0.92), 'neck')
    B['eye_l'] = ((0.178, -0.90, 0.945), (0.178, -1.0, 0.945), 'head')
    B['eye_r'] = ((-0.178, -0.90, 0.945), (-0.178, -1.0, 0.945), 'head')
    B['ear_l'] = ((0.25, -0.55, 1.18), (0.30, -0.55, 1.40), 'head')
    B['ear_r'] = ((-0.25, -0.55, 1.18), (-0.30, -0.55, 1.40), 'head')
    for s, sd in ((1, 'l'), (-1, 'r')):
        x = 0.18 * s
        B[f'f_up_{sd}'] = ((x, -0.31, 0.47), (x, -0.31, 0.27), 'chest')
        B[f'f_lo_{sd}'] = ((x, -0.31, 0.27), (x, -0.32, 0.07), f'f_up_{sd}')
        x = 0.21 * s
        B[f'h_up_{sd}'] = ((x, 0.31, 0.50), (x, 0.31, 0.27), 'hips')
        B[f'h_lo_{sd}'] = ((x, 0.31, 0.27), (x, 0.30, 0.07), f'h_up_{sd}')
    pts = [(0, 0.50, 0.58), (0, 0.72, 0.64), (0, 0.90, 0.78), (0, 1.00, 0.98), (0, 0.98, 1.18), (0, 0.90, 1.34)]
    for i in range(5):
        B[f'tail{i + 1}'] = (pts[i], pts[i + 1], 'hips' if i == 0 else f'tail{i}')
    return B


def seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


# ---------------------------------------------------------------- 무늬
def make_spots(pos, mask, seed=7, sep=0.17):
    rnd = random.Random(seed)
    idx = [i for i in range(len(pos)) if mask[i]]
    rnd.shuffle(idx)
    centers = []
    for i in idx:
        p = pos[i]
        if all(np.linalg.norm(p - c[0]) > sep * c[2] for c in centers):
            centers.append((p, rnd.uniform(0.055, 0.080), 1.0))
    return centers


def spot_value(pos, centers):
    v = np.zeros(len(pos))
    for c, r, _ in centers:
        d = np.linalg.norm(pos - c, axis=1)
        ring = np.exp(-(((d - r) / (r * 0.7)) ** 2))
        v = np.maximum(v, ring)
    return v


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rnd = random.Random(3)
    bm = bmesh.new()
    P_LIST = parts()
    info = []   # (part, start, end)
    wpos, lpos = [], []
    for p in P_LIST:
        start = len(bm.verts)
        r = bmesh.ops.create_icosphere(bm, subdivisions=p['sub'], radius=1.0)
        vs = r['verts']
        S = Matrix.Diagonal((p['r'].x, p['r'].y, p['r'].z, 1))
        R = Euler(p['rot'], 'XYZ').to_matrix().to_4x4()
        T = Matrix.Translation(p['c'])
        for v in vs:
            lpos.append(np.array(v.co))
            if p['kind'] == 'ear':
                u = (v.co.z + 1) / 2
                v.co.x *= 1 - 0.55 * u * u
                v.co.z *= 1.12
            v.co = (T @ R @ S) @ v.co
            wpos.append(np.array(v.co))
        info.append((p, start, len(bm.verts)))
    for f in bm.faces:
        f.smooth = True
    bm.verts.ensure_lookup_table()
    wpos = np.array(wpos)
    lpos = np.array(lpos)
    N = len(wpos)
    part_of = np.zeros(N, int)
    for k, (p, a, b) in enumerate(info):
        part_of[a:b] = k

    # ---------------- 정점 색
    col = np.zeros((N, 3))
    kinds = np.array([info[k][0]['kind'] for k in part_of])
    names = np.array([info[k][0]['name'] for k in part_of])
    # 기본 털색: 아래쪽·안쪽은 살짝 푸른 그늘
    shade = smooth(0.7, 0.2, wpos[:, 2]) * 0.35
    col[:] = WHITE * (1 - shade[:, None]) + FUR_SHADE * shade[:, None]
    # 무늬(몸통·다리·머리 이마)
    body = np.isin(kinds, ['fur']) & ~np.char.startswith(names, 'neckfluff')
    allow = body & (wpos[:, 2] > 0.17)
    head_m = (names == 'head')
    allow_head = head_m & (wpos[:, 2] > 1.02) & (wpos[:, 1] > -0.85)
    allow = (allow & ~head_m) | allow_head
    allow &= ~(np.char.startswith(names, 'chest') & (wpos[:, 1] < -0.42))
    centers = make_spots(wpos, allow)
    # 머리 무늬는 작게
    centers = [(c, r * (0.65 if c[2] > 1.0 else 1.0), s) for c, r, s in centers]
    sv = spot_value(wpos, centers)
    sv = np.where(kinds == 'fur', sv, 0)
    sv = np.where(allow, sv, 0)
    inner = smooth(0.2, 0.9, sv)
    spotcol = SPOT * 0.9 + SPOT_IN * 0.1
    col = col * (1 - inner[:, None] * 0.85) + spotcol * (inner[:, None] * 0.85)
    # 무늬 안쪽 연한 색(로제트 중심)
    # 얼굴 위 짙은 눈썹
    for s in (1, -1):
        d = np.sqrt(((wpos[:, 0] - 0.17 * s) / 0.09) ** 2 + ((wpos[:, 2] - 1.075) / 0.022) ** 2 + ((wpos[:, 1] + 0.88) / 0.10) ** 2)
        brow = smooth(1.0, 0.4, d) * (names == 'head')
        col = col * (1 - brow[:, None]) + LID * brow[:, None]
    # 볼 털: 하얗게
    cheek = np.isin(kinds, ['cheek', 'muzzle'])
    col[cheek] = WHITE * 0.97
    # 코
    nose = kinds == 'nose'
    col[nose] = NOSE
    # 입: 주둥이의 웃는 선
    mz = (names == 'muzzle')
    mouth = np.exp(-(((wpos[:, 2] - (0.80 + 0.35 * wpos[:, 0] ** 2 * 6)) / 0.009) ** 2)) * (np.abs(wpos[:, 0]) < 0.12) * (wpos[:, 1] < -0.93)
    col = col * (1 - (mouth * mz)[:, None]) + np.array([0.55, 0.30, 0.36]) * (mouth * mz)[:, None]
    # 발: 흰색
    paw = kinds == 'paw'
    col[paw] = PAW
    # 귀: 앞쪽(−Y) 분홍, 뒤쪽 짙은 청회색
    ear = kinds == 'ear'
    front = smooth(0.15, -0.55, lpos[:, 1])  # 로컬 y 음수 = 앞
    pink_area = ear & (lpos[:, 1] < -0.1) & (np.sqrt(lpos[:, 0] ** 2 + (lpos[:, 2] + 0.15) ** 2) < 0.62)
    col[ear] = EAR_OUT
    # 귀 가장자리 털 느낌: 안쪽은 분홍, 가장자리는 어두운 청회색
    inside = smooth(0.78, 0.45, np.sqrt(lpos[:, 0] ** 2 + (lpos[:, 2] + 0.12) ** 2))
    pk = (ear & (lpos[:, 1] < -0.05)) * inside
    col = col * (1 - pk[:, None]) + EAR_IN * pk[:, None]
    # 눈: 정면 방향(−Y) 기준 각도
    eye = kinds == 'eye'
    d = lpos / np.maximum(np.linalg.norm(lpos, axis=1, keepdims=True), 1e-6)
    th = np.arccos(np.clip(-d[:, 1], -1, 1))   # 정면에서 벗어난 각
    # 홍채(파랑) 그라데이션: 위쪽 짙고 아래쪽 밝음
    gy = np.clip(0.5 - d[:, 2] * 1.2, 0, 1)
    iris = IRIS * (1 - gy[:, None]) + IRIS_LIGHT * gy[:, None]
    ec = np.where((th < 0.50)[:, None], PUPIL, np.where((th < 1.12)[:, None], iris, np.where((th < 1.22)[:, None], LID, SCLERA)))
    # 하이라이트 (왼쪽 위 큰 점 + 오른쪽 아래 작은 점)
    hl1 = np.linalg.norm(d - np.array([0.28, -0.93, 0.26]) / np.linalg.norm([0.28, -0.93, 0.26]), axis=1) < 0.12
    hl2 = np.linalg.norm(d - np.array([-0.22, -0.95, -0.2]) / np.linalg.norm([-0.22, -0.95, -0.2]), axis=1) < 0.06
    ec = np.where((hl1 | hl2)[:, None], 1.0, ec)
    col[eye] = ec[eye]
    # 꼬리: 풍성한 청회색 + 둥근 무늬, 끝은 짙게
    tail = kinds == 'tail'
    seg = np.array([int(n[4:]) if n.startswith('tail') else 1 for n in names])
    t = (seg - 1) / 25.0
    tcol = TAIL_BASE * (1 - 0.25 * t[:, None]) + TAIL_DARK * (0.25 * t[:, None])
    # 아래쪽(안쪽)은 조금 밝게
    tcol = tcol * (1 - 0.0) + (WHITE * 0.15)
    tcol = np.clip(tcol, 0, 1)
    ring_phase = (np.sin(wpos[:, 1] * 15 + wpos[:, 0] * 9) * np.sin(wpos[:, 2] * 13 - wpos[:, 1] * 5)) * 0.5 + 0.5
    dark = smooth(0.55, 0.85, ring_phase) * 0.5
    tcol = tcol * (1 - dark[:, None]) + TAIL_DARK * dark[:, None]
    tip = smooth(0.75, 1.0, t)[:, None]
    tcol = tcol * (1 - tip * 0.5) + TAIL_DARK * 0.9 * tip * 0.5
    col[tail] = tcol[tail]
    col = lin(col)

    # ---------------- 메시 생성
    me = bpy.data.meshes.new('ice_leopard_s1')
    bm.to_mesh(me)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i in range(N):
        ca.data[i].color = (*col[i], 1.0)
    me.color_attributes.active_color = ca
    ob = bpy.data.objects.new('ice_leopard_s1', me)
    bpy.context.scene.collection.objects.link(ob)
    bm.free()
    mat = bpy.data.materials.new('fur')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    an = nt.nodes.new('ShaderNodeAttribute')
    an.attribute_name = 'Col'
    an.attribute_type = 'GEOMETRY'
    nt.links.new(an.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    me.materials.append(mat)

    # ---------------- 뼈대
    arm_d = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    B = skeleton()
    ebs = {}
    for n, (h, tl, par) in B.items():
        eb = arm_d.edit_bones.new(n)
        eb.head, eb.tail = Vector(h), Vector(tl)
        ebs[n] = eb
    for n, (h, tl, par) in B.items():
        eb = ebs[n]
        if par:
            eb.parent = ebs[par]
        d = (Vector(tl) - Vector(h)).normalized()
        z = Vector((1, 0, 0)).cross(d)
        if z.length > 1e-6:
            eb.align_roll(z)
        eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')

    # ---------------- 가중치: 파츠별 후보 뼈대와 거리 가우시안
    seg = {n: (np.array(h), np.array(t)) for n, (h, t, _) in B.items()}
    W = [dict() for _ in range(N)]
    for p, a, b in info:
        pts = wpos[a:b]
        cand = list(dict.fromkeys(p['bones']))
        if len(cand) == 1:
            for i in range(a, b):
                W[i][cand[0]] = 1.0
            continue
        sig = 0.09
        ds = np.stack([seg_dist(pts, *seg[c]) for c in cand], 1)
        # 첫 후보(주 뼈대)에 가산점
        w = np.exp(-((ds / sig) ** 2))
        w[:, 0] *= 2.0
        w /= w.sum(1, keepdims=True)
        for k, i in enumerate(range(a, b)):
            for j, c in enumerate(cand):
                if w[k, j] > 0.02:
                    W[i][c] = float(w[k, j])
    for n in B:
        ob.vertex_groups.new(name=n)
    for i in range(N):
        tot = sum(W[i].values())
        items = sorted(W[i].items(), key=lambda kv: -kv[1])[:4]
        tot = sum(v for _, v in items)
        for n, v in items:
            ob.vertex_groups[n].add([i], v / tot, 'REPLACE')
    ob.parent = arm
    md = ob.modifiers.new('Armature', 'ARMATURE')
    md.object = arm
    for p in me.polygons:
        p.use_smooth = True
    return ob, arm


if __name__ == '__main__':
    build()
