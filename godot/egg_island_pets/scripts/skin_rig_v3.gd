## 설표 1단계 v3 — Polygon2D 스키닝 메시 + Skeleton2D
## 파츠를 잘라 돌리지 않고 한 그림 안에서 관절이 휘어진다 → 어깨·엉덩이·목·꼬리 연결부에 이음새가 없다.
##   Walk  : 옆모습 걷기 원본 → 몸통·머리·꼬리 + 다리 4개(엉덩이·어깨 / 무릎) — 걷기·달리기
##   Idle  : 정면 앉은 원본 한 장 → 몸통(숨쉬기)·머리·꼬리 — 대기, 부비부비 시작·끝
##   React : 쓰다듬기 반응 원본 한 장 → 몸통·머리·꼬리 + 원본 하트(떼어 내 떠오르게) — 쓰다듬기 반응
##   Close : 근접 교감 원본 4장 — 부비부비
## 데이터: parts/ice_leopard_s1_v3*/skin.json (scripts/pets/godot/make_skin_mesh_v3.py, make_skin_front_v3.py)
class_name SkinRigV3
extends RefCounted

const FPS := 30.0
const LEGS := ["leg_hind_near", "leg_hind_far", "leg_front_far", "leg_front_near"]
const RIGS := ["Walk", "Idle", "React", "Close"]
const CLOSE := ["cl_notice_approach", "cl_closeup", "cl_rub_cheek", "cl_gaze_back_off"]

static func load_tex(dir: String, file: String) -> Texture2D:
	return ImageTexture.create_from_image(Image.load_from_file(ProjectSettings.globalize_path(dir.path_join(file))))

## 스키닝 리그 하나 (원점 = 발밑 가운데)
static func build_rig(dir: String, rig_name: String) -> Dictionary:
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join("skin.json")))
	var origin := Vector2(d["origin"][0], d["origin"][1])
	var node := Node2D.new()
	node.name = rig_name
	var sk := Skeleton2D.new()
	sk.name = "Skeleton"
	node.add_child(sk)
	var bones := {}
	var piv := {}
	for bn in d["bones"]:
		var info: Dictionary = d["bones"][bn]
		var b := Bone2D.new()
		b.name = bn
		b.set_autocalculate_length_and_angle(false)
		b.set_length(10.0)
		var p := Vector2(info["pivot"][0], info["pivot"][1])
		piv[bn] = p
		if info["parent"] == null:
			b.position = p - origin
			sk.add_child(b)
		else:
			b.position = p - piv[info["parent"]]
			bones[info["parent"]].add_child(b)
		b.rest = b.transform
		bones[bn] = b
	var order := ["tail", "leg_hind_far", "leg_front_far", "body", "head", "leg_hind_near", "leg_front_near"]
	for pn in order:
		if not d["parts"].has(pn):
			continue
		var part: Dictionary = d["parts"][pn]
		var poly := Polygon2D.new()
		poly.name = "mesh_" + pn
		poly.texture = load_tex(dir, part["file"])
		poly.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		var verts := PackedVector2Array()
		for v in part["verts"]:
			verts.append(Vector2(v[0], v[1]) - origin)
		var uvs := PackedVector2Array()
		for u in part["uvs"]:
			uvs.append(Vector2(u[0], u[1]))
		poly.polygon = verts
		poly.uv = uvs
		var tris := []
		for t in part["tris"]:
			tris.append(PackedInt32Array(t))
		poly.polygons = tris
		poly.z_index = int(part["z"])
		node.add_child(poly)
		poly.skeleton = poly.get_path_to(sk)
		for bn in part["weights"]:
			poly.add_bone(NodePath(String(sk.get_path_to(bones[bn]))), PackedFloat32Array(part["weights"][bn]))
	return {"node": node, "bones": bones, "data": d, "origin": origin, "dir": dir}

static func build(base: String) -> Node2D:
	var pet := Node2D.new()
	pet.name = "Pet"
	var walk := build_rig(base, "Walk")
	var idle := build_rig(base + "_idle", "Idle")
	var react := build_rig(base + "_react", "React")
	for r in [walk, idle, react]:
		pet.add_child(r["node"])
	# 원본 하트: 반응 포즈에 그려져 있던 하트를 떼어 내 떠오르게
	var rd: Dictionary = react["data"]
	var heart := Sprite2D.new()
	heart.name = "Heart"
	heart.texture = load_tex(react["dir"], rd["heart"]["file"])
	heart.position = Vector2(rd["heart"]["center"][0], rd["heart"]["center"][1]) - react["origin"]
	heart.z_index = 30
	pet.add_child(heart)
	pet.set_meta("heart_rest", heart.position)
	# 근접 교감 원본 4장 (v1 파츠 폴더의 원본 그대로)
	var close := Node2D.new()
	close.name = "Close"
	pet.add_child(close)
	var cdir := "res://parts/ice_leopard_s1"
	var crig: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(cdir.path_join("rig.json")))
	for n in CLOSE:
		var s := Sprite2D.new()
		s.name = n
		s.texture = load_tex(cdir, crig["closeup"][n]["file"])
		var sz: Array = crig["closeup"][n]["size"]
		s.centered = false
		var bottom: bool = n == "cl_notice_approach" or n == "cl_gaze_back_off"
		s.offset = Vector2(-sz[0] / 2.0, -sz[1]) if bottom else Vector2(-sz[0] / 2.0, -sz[1] / 2.0)
		s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		s.z_index = 20
		close.add_child(s)
	var ap := AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	pet.add_child(ap)
	var lib := AnimationLibrary.new()
	lib.add_animation("walk", anim_gait("walk", walk, WALK))
	lib.add_animation("run", anim_gait("run", walk, RUN))
	lib.add_animation("idle", anim_idle(idle))
	lib.add_animation("pet_react", anim_react(idle, react, pet))
	lib.add_animation("nuzzle", anim_nuzzle(idle))
	ap.add_animation_library("", lib)
	return pet

# ───────────────────────── 공통 ─────────────────────────
class Baker:
	var a: Animation
	var tracks := {}
	func _init(name: String, length: float, loop: bool) -> void:
		a = Animation.new()
		a.resource_name = name
		a.length = length
		a.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
		a.step = 1.0 / FPS
	func key(path: String, t: float, v) -> void:
		if not tracks.has(path):
			var i := a.add_track(Animation.TYPE_VALUE)
			a.track_set_path(i, NodePath(path))
			# 표시·투명도는 계단식(프레임 사이에서 반투명으로 섞여 겹쳐 보이지 않게), 움직임은 선형
			var stepped := typeof(v) == TYPE_BOOL or typeof(v) == TYPE_COLOR
			a.track_set_interpolation_type(i, Animation.INTERPOLATION_NEAREST if stepped else Animation.INTERPOLATION_LINEAR)
			a.value_track_set_update_mode(i, Animation.UPDATE_DISCRETE if typeof(v) == TYPE_BOOL else Animation.UPDATE_CONTINUOUS)
			tracks[path] = i
		a.track_insert_key(tracks[path], t, v)
	func frames() -> int:
		return int(round(a.length * FPS))

## 리그 표시: alpha 가 0 이면 숨김. 새 그림은 기존 그림 위에서 서서히 나타난다(겹침 전환)
static func show(b: Baker, t: float, alphas: Dictionary) -> void:
	for r in RIGS:
		var v: float = alphas.get(r, 0.0)
		b.key(r + ":visible", t, v > 0.001)
		b.key(r + ":modulate", t, Color(1, 1, 1, v))
	b.key("Heart:visible", t, false)

static func ease_io(x: float) -> float:
	x = clampf(x, 0.0, 1.0)
	return x * x * (3.0 - 2.0 * x)

static func ramp(t: float, t0: float, t1: float) -> float:
	return ease_io((t - t0) / (t1 - t0))

## 장면 전환은 겹쳐 보이지 않게 한 프레임에 바꾸고, 새로 나타난 그림을 살짝 눌렀다 펴서(팝) 자연스럽게 잇는다
static func pop(t: float, t0: float) -> float:
	if t < t0 or t > t0 + 0.16:
		return 1.0
	var u := (t - t0) / 0.16
	return 1.0 - 0.07 * (1.0 - u) * (1.0 - u)

# ───────────────────────── 걷기 · 달리기 (발 위치 → 2관절 IK) ─────────────────────────
## 걷기: 측대 순서 walk. 뒷다리(가까운)→앞다리(가까운)→뒷다리(먼)→앞다리(먼), 1/4 주기 간격, 62% 동안 바닥을 짚음
const WALK := {
	"cycle": 1.0, "duty": 0.62, "stride": 18.0, "crouch": 2.0,
	"phase": {"leg_hind_near": 0.0, "leg_front_near": 0.25, "leg_hind_far": 0.5, "leg_front_far": 0.75},
	"foot": {"leg_hind_near": [66.0, 275.0, 7.0], "leg_hind_far": [158.0, 276.0, 6.0],
		"leg_front_far": [201.0, 277.0, 7.0], "leg_front_near": [313.0, 272.0, 8.0]},
	"bob": 1.1, "bob_freq": 2.0, "pitch": 0.010, "head": 0.018, "tail": 0.10, "tail_base": 0.0, "air": 0.0}
## 달리기: 갤럽. 뒷다리 두 개가 차고(0~0.4) 공중(0.4~0.5) → 앞다리 두 개가 받고(0.5~0.9) 공중(0.9~1.0)
const RUN := {
	"cycle": 0.5, "duty": 0.30, "stride": 34.0, "crouch": 3.0,
	"phase": {"leg_hind_near": 0.0, "leg_hind_far": 0.9, "leg_front_near": 0.5, "leg_front_far": 0.4},
	"foot": {"leg_hind_near": [70.0, 275.0, 13.0], "leg_hind_far": [160.0, 276.0, 12.0],
		"leg_front_far": [203.0, 277.0, 14.0], "leg_front_near": [310.0, 272.0, 15.0]},
	"bob": 0.0, "bob_freq": 2.0, "pitch": 0.07, "head": 0.035, "tail": 0.16, "tail_base": -0.22, "air": 12.0}

static func gait_speed(p: Dictionary, k: float) -> float:
	return float(p["stride"]) * k / (float(p["duty"]) * float(p["cycle"]))

static func foot_target(p: Dictionary, n: String, u: float, k: float, off: float) -> Vector2:
	var f: Array = p["foot"][n]
	var duty: float = p["duty"]
	var stride: float = p["stride"]
	var x: float
	var y: float = f[1]
	if u < duty:
		x = float(f[0]) + stride / 2.0 - stride * (u / duty)
	else:
		var s := (u - duty) / (1.0 - duty)
		x = float(f[0]) - stride / 2.0 + stride * ease_io(s)
		y = float(f[1]) - float(f[2]) * sin(PI * s)
	return Vector2((x + off) * k, (y + off) * k)

static func anim_gait(name: String, rig: Dictionary, p: Dictionary) -> Animation:
	var d: Dictionary = rig["data"]
	var bones: Dictionary = rig["bones"]
	var origin: Vector2 = rig["origin"]
	var k: float = d["k"]
	var off: float = d["off"]
	var L: float = p["cycle"]
	var b := Baker.new(name, L, true)
	var body: Bone2D = bones["body"]
	var body_rest: Vector2 = body.position
	for fi in b.frames() + 1:
		var t := fi / FPS
		var u0 := t / L
		var ph := TAU * u0
		show(b, t, {"Walk": 1.0})
		var y_off := float(p["crouch"]) + float(p["bob"]) * cos(float(p["bob_freq"]) * ph)
		var pitch := float(p["pitch"]) * sin(ph)
		if float(p["air"]) > 0.0:
			# 갤럽: 뒷다리가 찬 뒤(0.45)와 앞다리가 찬 뒤(0.95) 몸이 떠오른다. 뒷다리로 찰 때 머리가 들림
			var lift := pow(maxf(0.0, cos(TAU * (u0 - 0.45))), 3.0) + pow(maxf(0.0, cos(TAU * (u0 - 0.95))), 3.0)
			y_off -= float(p["air"]) * lift
			pitch = -float(p["pitch"]) * sin(TAU * (u0 - 0.05))
		var bpos: Vector2 = body_rest + Vector2(0, y_off * k)
		b.key("Walk/Skeleton/body:position", t, bpos)
		b.key("Walk/Skeleton/body:rotation", t, pitch)
		b.key("Walk/Skeleton/body/tail:rotation", t, float(p["tail_base"]) + float(p["tail"]) * sin(ph - 0.9) + 0.25 * float(p["tail"]) * sin(2.0 * ph - 0.4))
		var bx := Transform2D(pitch, bpos)
		for n in LEGS:
			var u: float = fposmod(u0 + float(p["phase"][n]), 1.0)
			var target_sk: Vector2 = foot_target(p, n, u, k, off) - origin
			var tl: Vector2 = bx.affine_inverse() * target_sk
			var leg: Bone2D = bones[n]
			var low: Bone2D = bones[n + "_lower"]
			var h: Vector2 = leg.rest.origin
			var k0: Vector2 = h + low.rest.origin
			var foot_rest: Vector2 = Vector2(d["feet"][n][0], d["feet"][n][1]) - origin - body_rest
			var la := (k0 - h).length()
			var lb := (foot_rest - k0).length()
			var a0 := (k0 - h).angle()
			var b0 := (foot_rest - k0).angle()
			var v := tl - h
			var dist := clampf(v.length(), absf(la - lb) + 1.0, (la + lb) * 0.999)
			var alpha := acos(clampf((la * la + dist * dist - lb * lb) / (2.0 * la * dist), -1.0, 1.0))
			var base := v.angle()
			var u1 := base + alpha
			var u2 := base - alpha
			var kn1 := h + Vector2.from_angle(u1) * la
			var kn2 := h + Vector2.from_angle(u2) * la
			var hind: bool = n.begins_with("leg_hind")
			var upper: float = u1 if ((kn1.x > kn2.x) == hind) else u2
			var knee := h + Vector2.from_angle(upper) * la
			var lower: float = (h + v.normalized() * dist - knee).angle()
			var r_up: float = wrapf(upper - a0, -PI, PI)
			var r_low: float = wrapf((lower - b0) - r_up, -PI, PI)
			b.key("Walk/Skeleton/body/%s:rotation" % n, t, r_up)
			b.key("Walk/Skeleton/body/%s/%s_lower:rotation" % [n, n], t, r_low)
	return b.a

# ───────────────────────── 대기 ─────────────────────────
## 숨쉬기(가슴이 살짝 부풀었다 가라앉음), 고개를 천천히 갸웃, 꼬리 끝이 느리게 살랑
static func idle_pose(b: Baker, t: float, rig: Dictionary, prefix: String) -> void:
	var k: float = rig["data"]["k"]
	var ph := TAU * t / 3.0
	var br := sin(ph) * 0.5 + 0.5
	b.key(prefix + "/Skeleton/body:scale", t, Vector2(1.0 + br * 0.006, 1.0 + br * 0.014))
	var head: Bone2D = rig["bones"]["head"]
	b.key(prefix + "/Skeleton/body/head:rotation", t, 0.028 * sin(ph) + 0.008 * sin(2.0 * ph + 1.0))
	b.key(prefix + "/Skeleton/body/head:position", t, head.rest.origin + Vector2(0, -br * 0.8 * k))
	b.key(prefix + "/Skeleton/body/tail:rotation", t, 0.06 * sin(2.0 * ph - 0.6))

static func anim_idle(idle: Dictionary) -> Animation:
	var b := Baker.new("idle", 3.0, true)
	for fi in b.frames() + 1:
		var t := fi / FPS
		show(b, t, {"Idle": 1.0})
		idle_pose(b, t, idle, "Idle")
	return b.a

# ───────────────────────── 쓰다듬기 반응 ─────────────────────────
## 대기 → (겹쳐 전환) 눈 감고 고개 들어 손에 머리를 비비는 원본 포즈 → 좌우로 비비기 + 하트가 떠오름 → 대기
static func anim_react(idle: Dictionary, react: Dictionary, pet: Node2D) -> Animation:
	var L := 2.6
	var b := Baker.new("pet_react", L, false)
	var k: float = react["data"]["k"]
	var head: Bone2D = react["bones"]["head"]
	var heart_rest: Vector2 = pet.get_meta("heart_rest")
	for fi in b.frames() + 1:
		var t := fi / FPS
		var on := t >= 0.20 and t < 2.35
		show(b, t, {"Idle": 0.0 if on else 1.0, "React": 1.0 if on else 0.0})
		idle_pose(b, t, idle, "Idle")
		var ib: Bone2D = idle["bones"]["body"]
		var ip := pop(t, 2.35)
		var br := sin(TAU * t / 3.0) * 0.5 + 0.5
		b.key("Idle/Skeleton/body:scale", t, Vector2((1.0 + br * 0.006) * (2.0 - ip), (1.0 + br * 0.014) * ip))
		var rp := pop(t, 0.20)
		var env := sin(PI * clampf((t - 0.3) / 1.95, 0.0, 1.0))
		var w := sin(TAU * (t - 0.3) / 0.62)
		# 고개와 목털이 이어진 포즈라 머리만 꺾지 않고, 앉은 엉덩이를 축으로 몸 전체를 좌우로 기울여 비빈다
		b.key("React/Skeleton/body:rotation", t, w * 0.045 * env)
		b.key("React/Skeleton/body:scale", t, Vector2((1.0 + absf(w) * 0.008 * env) * (2.0 - rp), (1.0 - absf(w) * 0.016 * env) * rp))
		b.key("React/Skeleton/body/tail:rotation", t, 0.10 * sin(TAU * t / 0.9) * env)
		# 하트: 0.45초에 톡 튀어나와 위로 떠오르며 사라짐
		var hu := clampf((t - 0.45) / 1.3, 0.0, 1.0)
		var pop := 1.0 + 0.25 * sin(PI * clampf(hu / 0.25, 0.0, 1.0))
		b.key("Heart:visible", t, t >= 0.45 and t <= 1.75)
		b.key("Heart:position", t, heart_rest + Vector2(6.0 * k * sin(TAU * hu), -34.0 * k * hu))
		b.key("Heart:scale", t, Vector2.ONE * minf(1.0, hu / 0.12) * pop)
		b.key("Heart:modulate", t, Color(1, 1, 1, 1.0 - ramp(hu, 0.6, 1.0)))
	return b.a

# ───────────────────────── 부비부비 ─────────────────────────
## 대기(발견: 고개 갸웃·깡충) → 다가오기 → 얼굴 클로즈업 → 눈 감고 볼 비비기 → 물러나기 → 대기. 단계 사이는 겹쳐 전환
static func anim_nuzzle(idle: Dictionary) -> Animation:
	var L := 6.8
	var b := Baker.new("nuzzle", L, false)
	var k: float = idle["data"]["k"]
	var idle_body: Bone2D = idle["bones"]["body"]
	var C := "Close/"
	for fi in b.frames() + 1:
		var t := fi / FPS
		# 단계 전환: 한 프레임에 바꾸고 새 그림은 팝으로 등장 (겹쳐 보이지 않음)
		var a_idle: float = 1.0 if (t < 0.6 or t >= 6.4) else 0.0
		var a_app: float = 1.0 if (t >= 0.6 and t < 2.0) else 0.0
		var a_cl: float = 1.0 if (t >= 2.0 and t < 2.9) else 0.0
		var a_rub: float = 1.0 if (t >= 2.9 and t < 4.85) else 0.0
		var a_back: float = 1.0 if (t >= 4.85 and t < 6.4) else 0.0
		show(b, t, {"Idle": a_idle, "Close": 1.0 if (a_app + a_cl + a_rub + a_back) > 0.001 else 0.0})
		var al := [a_app, a_cl, a_rub, a_back]
		for i in CLOSE.size():
			b.key(C + CLOSE[i] + ":visible", t, float(al[i]) > 0.001)
			b.key(C + CLOSE[i] + ":modulate", t, Color(1, 1, 1, float(al[i])))
		# 1) 발견: 고개 갸웃 + 깡충
		var hop := sin(PI * clampf((t - 0.15) / 0.3, 0.0, 1.0))
		idle_pose(b, t, idle, "Idle")
		b.key("Idle/Skeleton/body/head:rotation", t, 0.11 * sin(PI * clampf(t / 0.55, 0.0, 1.0)) if t < 0.6 else 0.035 * sin(TAU * t / 3.0))
		b.key("Idle/Skeleton/body:position", t, idle_body.rest.origin + Vector2(0, -hop * 7.0 * k if t < 0.6 else 0.0))
		if t >= 6.4:
			var q := pop(t, 6.4)
			b.key("Idle/Skeleton/body:scale", t, Vector2(2.0 - q, q))
		# 2) 다가오기 (걸음 리듬으로 통통)
		var ua := ease_io(clampf((t - 0.6) / 1.4, 0.0, 1.0))
		var st := sin(TAU * 2.0 * clampf((t - 0.6) / 1.4, 0.0, 1.0))
		b.key(C + "cl_notice_approach:scale", t, Vector2.ONE * lerpf(1.08, 1.26, ua) * pop(t, 0.6))
		b.key(C + "cl_notice_approach:position", t, Vector2(0, -absf(st) * 5.0 * k))
		b.key(C + "cl_notice_approach:rotation", t, st * 0.03)
		# 3) 클로즈업 (아주 약한 숨쉬기)
		var uc := clampf((t - 2.0) / 0.9, 0.0, 1.0)
		b.key(C + "cl_closeup:scale", t, Vector2.ONE * lerpf(0.97, 1.0, ease_io(uc)) * pop(t, 2.0))
		b.key(C + "cl_closeup:position", t, Vector2(0, -190.0 * k))
		b.key(C + "cl_closeup:rotation", t, sin(PI * uc) * 0.02)
		# 4) 볼 비비기 (좌우로 기울이며 비빔, 살짝 눌림)
		var ur := clampf((t - 2.9) / 1.95, 0.0, 1.0)
		var rw := sin(TAU * (t - 2.9) / 0.66) * sin(PI * ur)
		b.key(C + "cl_rub_cheek:rotation", t, rw * 0.06)
		b.key(C + "cl_rub_cheek:position", t, Vector2(rw * 10.0 * k, -190.0 * k + absf(rw) * 3.0 * k))
		b.key(C + "cl_rub_cheek:scale", t, Vector2(1.0 + absf(rw) * 0.012, 1.0 - absf(rw) * 0.02) * pop(t, 2.9))
		# 5) 물러나기
		var ub := ease_io(clampf((t - 4.85) / 1.55, 0.0, 1.0))
		var bs := sin(TAU * 2.0 * clampf((t - 4.85) / 1.55, 0.0, 1.0))
		b.key(C + "cl_gaze_back_off:scale", t, Vector2.ONE * lerpf(1.36, 1.22, ub) * pop(t, 4.85))
		b.key(C + "cl_gaze_back_off:position", t, Vector2(0, -absf(bs) * 4.0 * k))
		b.key(C + "cl_gaze_back_off:rotation", t, bs * 0.025)
	return b.a
