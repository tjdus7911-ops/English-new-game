"""
설표 1단계 애니메이션 6종(대기·걷기·달리기·잠자기·쓰다듬기 반응·부비부비)을 뼈대에 굽고 GLB 로 내보낸다.
다리는 2관절 해석적 IK(코드)로 발 위치를 풀어 발이 땅에 붙게 한다.
실행: xvfb-run -a python3 leopard_anim.py <out.glb>
"""
import json
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import leopard_model as M

FPS = 30
G = 0.07                          # 발목 높이(바닥 위)
HIP_PIVOT = (0.32, 0.50)          # 엉덩이 뼈대 머리 (y, z)
LEG = {  # 이름: (관절 rest(y,z), L1, L2, 앞다리 여부, 발 rest y)
    'f_l': ((-0.31, 0.47), 0.20, 0.20, True, -0.32), 'f_r': ((-0.31, 0.47), 0.20, 0.20, True, -0.32),
    'h_l': ((0.31, 0.50), 0.23, 0.20, False, 0.30), 'h_r': ((0.31, 0.50), 0.23, 0.20, False, 0.30),
}


def ss(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


class Pose:
    def __init__(self, arm):
        self.arm = arm
        self.rot = {}
        self.loc = {}
        self.scl = {}

    def r(self, b, x=0.0, y=0.0, z=0.0):
        o = self.rot.get(b, (0, 0, 0))
        self.rot[b] = (o[0] + x, o[1] + y, o[2] + z)

    def l(self, b, x=0.0, y=0.0, z=0.0):
        o = self.loc.get(b, (0, 0, 0))
        self.loc[b] = (o[0] + x, o[1] + y, o[2] + z)

    def s(self, b, x=1.0, y=1.0, z=1.0):
        self.scl[b] = (x, y, z)


def solve_leg(joint, target, L1, L2, front):
    vy, vz = target[0] - joint[0], target[1] - joint[1]
    d = min(max(math.hypot(vy, vz), abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3)
    phi = math.atan2(vy, -vz)
    al = math.acos(max(-1, min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
    a1 = phi + al if front else phi - al
    ky, kz = joint[0] + L1 * math.sin(a1), joint[1] - L1 * math.cos(a1)
    psi = math.atan2(target[0] - ky, -(target[1] - kz))
    return a1, psi - a1


def place_legs(P, feet, dz, pitch, lean_comp=0.0):
    """feet: {'f_l': (y, z), ...} 월드 발목 목표. 몸통 높이 dz, 피치 pitch 를 고려해 풀기."""
    for k, (jr, L1, L2, front, fy0) in LEG.items():
        ry, rz = jr[0] - HIP_PIVOT[0], jr[1] - HIP_PIVOT[1]
        c, s = math.cos(pitch), math.sin(pitch)
        jy = HIP_PIVOT[0] + ry * c - rz * s
        jz = HIP_PIVOT[1] + dz + ry * s + rz * c
        a1, a2 = solve_leg((jy, jz), feet[k], L1, L2, front)
        sd = k[-1]
        P.r(f"{'f' if front else 'h'}_up_{sd}", x=a1 - pitch - (lean_comp if front else 0))
        P.r(f"{'f' if front else 'h'}_lo_{sd}", x=a2)


def tail_wave(P, t, amp, phase_lag=0.55, freq=1.0, base=0.0, up=0.0):
    for i in range(5):
        P.r(f'tail{i + 1}', z=base / 5 + amp * math.sin(2 * math.pi * freq * t - i * phase_lag) * (0.45 + 0.2 * i),
            x=up / 5)


def gait(P, t, cfg):
    T = cfg['T']
    ph = {k: (t / T + o) % 1.0 for k, o in cfg['off'].items()}
    beta, S, H = cfg['beta'], cfg['S'], cfg['H']
    feet = {}
    for k, p in ph.items():
        fy0 = LEG[k][4]
        if p < beta:
            u = S / 2 - S * (p / beta)
            lift = 0.0
        else:
            q = (p - beta) / (1 - beta)
            u = -S / 2 + S * ss(q)
            lift = H * math.sin(math.pi * q) ** 1.2
        feet[k] = (fy0 - u * (1 if True else -1) * 1.0 + (cfg.get('shift', {}).get(k, 0.0)), G + lift)
    dz = cfg['dz'] + cfg['bob'] * math.cos(2 * math.pi * cfg['bobf'] * t / T + cfg.get('bobph', 0))
    pitch = cfg['pitch'] * math.sin(2 * math.pi * t / T + cfg.get('pitchph', 0))
    P.l('hips', z=dz)
    P.r('hips', x=pitch)
    place_legs(P, feet, dz, pitch)
    # 머리는 수평 유지(피치 보정) + 살짝 끄덕
    P.r('neck', x=-pitch * 0.5 + 0.02)
    P.r('head', x=-pitch * 0.5 + cfg.get('nod', 0.04) * math.sin(2 * math.pi * 2 * t / T))
    P.r('spine', z=cfg.get('wig', 0.04) * math.sin(2 * math.pi * t / T))
    P.r('chest', z=-cfg.get('wig', 0.04) * 1.4 * math.sin(2 * math.pi * t / T))
    tail_wave(P, t / T * 1.0, cfg['tail'], freq=1.0, up=cfg.get('tailup', 0.0))
    for s, b in ((1, 'ear_l'), (-1, 'ear_r')):
        P.r(b, x=cfg.get('earback', 0.0) + 0.04 * math.sin(2 * math.pi * 2 * t / T))


ANIMS = {}


def anim(name, frames, loop=True, speed=0.0):
    def deco(fn):
        ANIMS[name] = dict(fn=fn, frames=frames, loop=loop, speed=speed)
        return fn
    return deco


WALK = dict(T=1.0, beta=0.62, S=0.30, H=0.07, dz=0.045, bob=0.010, bobf=2, pitch=0.025, tail=0.35, wig=0.05,
            off={'h_l': 0.0, 'f_l': 0.25, 'h_r': 0.5, 'f_r': 0.75})
RUN = dict(T=0.6, beta=0.38, S=0.52, H=0.15, dz=0.075, bob=0.03, bobf=1, bobph=math.pi * 0.55, pitch=0.10, pitchph=math.pi * 1.05,
           tail=0.28, wig=0.02, tailup=-0.5, earback=-0.55, nod=0.03, off={'f_r': 0.0, 'f_l': 0.10, 'h_r': 0.50, 'h_l': 0.60})
WALK['speed'] = WALK['S'] / (WALK['beta'] * WALK['T'])
RUN['speed'] = RUN['S'] / (RUN['beta'] * RUN['T'])


@anim('walk', 30, speed=WALK['speed'])
def a_walk(P, t, f):
    gait(P, t * WALK['T'], WALK)


@anim('run', 18, speed=RUN['speed'])
def a_run(P, t, f):
    gait(P, t * RUN['T'], RUN)


def stand(P, dz=0.0):
    feet = {'f_l': (-0.32, G), 'f_r': (-0.32, G), 'h_l': (0.30, G), 'h_r': (0.30, G)}
    P.l('hips', z=dz)
    place_legs(P, feet, dz, 0.0)


def blink(P, t, at=(0.42, 0.47)):
    k = 0.0
    if at[0] <= t < at[1]:
        u = (t - at[0]) / (at[1] - at[0])
        k = math.sin(math.pi * u)
    v = 1 - 0.93 * k
    P.s('eye_l', 1, 1, v)
    P.s('eye_r', 1, 1, v)


@anim('idle', 90)
def a_idle(P, t, f):
    a = 2 * math.pi * t
    breath = math.sin(a)
    stand(P, dz=0.035 + 0.006 * breath)
    P.r('chest', x=0.012 * breath)
    P.r('neck', x=-0.02 * breath, z=0.10 * math.sin(a * 1))
    P.r('head', z=0.14 * math.sin(a), y=0.05 * math.sin(a * 2 + 1))
    tail_wave(P, t, 0.20, freq=1.0)
    twitch = max(0, math.sin(a * 3 + 0.5)) ** 12
    P.r('ear_l', x=-0.25 * twitch)
    P.r('ear_r', x=-0.1 * max(0, math.sin(a * 2 + 2)) ** 10)
    blink(P, t, (0.62, 0.67))


@anim('sleep', 120)
def a_sleep(P, t, f):
    a = 2 * math.pi * t
    dz = 0.175 + 0.004 * math.sin(a)
    feet = {'f_l': (-0.64, G), 'f_r': (-0.64, G), 'h_l': (0.10, G), 'h_r': (0.10, G)}
    P.l('hips', z=dz)
    P.r('hips', x=0.0)
    place_legs(P, feet, dz, 0.0)
    P.r('spine', x=0.02 * math.sin(a))
    P.r('neck', x=0.30, z=0.10)
    P.r('head', x=0.18, y=-0.28)
    P.s('eye_l', 1, 1, 0.05)
    P.s('eye_r', 1, 1, 0.05)
    P.r('ear_l', x=0.35)
    P.r('ear_r', x=0.35)
    for i in range(5):                       # 꼬리를 몸 옆으로 둥글게
        P.r(f'tail{i + 1}', z=0.55 + 0.03 * math.sin(a * 0.5 - i * 0.3), x=0.18)


@anim('pet_react', 60)
def a_pet(P, t, f):
    a = 2 * math.pi * t
    pulse = 0.5 - 0.5 * math.cos(a)
    stand(P, dz=0.035 - 0.012 * pulse)
    P.r('chest', x=-0.05 * pulse)
    P.r('neck', x=-0.22 * pulse, z=0.06 * math.sin(a * 2))
    P.r('head', x=-0.15 * pulse, y=0.20 * math.sin(a * 2), z=0.05 * math.sin(a * 2 + 1))
    P.l('head', y=0.05 * pulse)
    v = 1 - 0.62 * ss(min(1, pulse * 1.6))
    P.s('eye_l', 1, 1, v)
    P.s('eye_r', 1, 1, v)
    P.r('ear_l', x=0.5 * pulse)
    P.r('ear_r', x=0.5 * pulse)
    tail_wave(P, t * 3, 0.55, phase_lag=0.4, freq=1.0, up=-0.3)
    P.r('spine', z=0.05 * math.sin(a * 3))


@anim('nuzzle', 90)
def a_nuzzle(P, t, f):
    a = 2 * math.pi * t
    reach = ss(t / 0.18) if t < 0.5 else ss((1 - t) / 0.18)
    lean = 0.14 * reach
    feet = {'f_l': (-0.32, G), 'f_r': (-0.32, G), 'h_l': (0.30, G), 'h_r': (0.30, G)}
    dz = 0.035 + 0.03 * reach
    P.l('hips', z=dz)
    P.r('hips', x=lean)
    place_legs(P, feet, dz, lean)
    P.r('neck', x=0.10 * reach - lean * 0.5)
    rub = math.sin(a * 3) * reach
    P.r('head', y=0.30 * rub, z=0.18 * rub, x=-0.05 * reach - lean * 0.4)
    P.l('head', y=0.30 * reach)                                   # 얼굴이 카메라(앞) 쪽으로
    v = 1 - 0.55 * reach
    P.s('eye_l', 1, 1, v)
    P.s('eye_r', 1, 1, v)
    P.r('ear_l', x=0.3 * reach)
    P.r('ear_r', x=0.3 * reach)
    tail_wave(P, t * 2, 0.35, freq=1.0, up=-0.2)


def bake(arm):
    arm.animation_data_create()
    bpy.context.view_layer.objects.active = arm
    names = [pb.name for pb in arm.pose.bones]
    meta = {}
    for name, a in ANIMS.items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        n = a['frames']
        for pb in arm.pose.bones:
            pb.rotation_mode = 'XYZ'
        for f in range(n + 1):
            P = Pose(arm)
            a['fn'](P, (f % n) / n, f)
            for pb in arm.pose.bones:
                pb.rotation_euler = P.rot.get(pb.name, (0, 0, 0))
                pb.location = P.loc.get(pb.name, (0, 0, 0))
                pb.scale = P.scl.get(pb.name, (1, 1, 1))
            for b in set(P.rot) | set(P.loc) | set(P.scl):
                pb = arm.pose.bones[b]
                if b in P.rot:
                    pb.keyframe_insert('rotation_euler', frame=f + 1)
                if b in P.loc:
                    pb.keyframe_insert('location', frame=f + 1)
                if b in P.scl:
                    pb.keyframe_insert('scale', frame=f + 1)
        meta[name] = {'fps': FPS, 'frames': n, 'loop': a['loop'], 'speed_m_s': round(a['speed'], 3)}
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return meta


def main():
    out = Path(sys.argv[-1])
    ob, arm = M.build()
    bpy.context.scene.render.fps = FPS
    meta = bake(arm)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True, export_animations=True,
                              export_animation_mode='ACTIONS', export_apply=False, export_skins=True,
                              export_image_format='NONE', export_vertex_color='ACTIVE', export_optimize_animation_size=True)
    out.with_suffix('.json').write_text(json.dumps({'anims': meta, 'faces': len(ob.data.polygons)}, ensure_ascii=False, indent=1))
    print('EXPORTED', out, out.stat().st_size // 1024, 'KB', meta)


if __name__ == '__main__':
    main()
