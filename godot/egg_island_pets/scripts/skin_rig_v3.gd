## 설표 1단계 v3 리그 — Polygon2D 스키닝 메시 + Skeleton2D (몸통·머리·꼬리·다리 4개×2관절)
## 파츠를 잘라 돌리지 않고, 하나의 그림 안에서 관절이 휘어진다 → 어깨·엉덩이·목·꼬리 연결부에 이음새가 없다.
## 데이터: parts/ice_leopard_s1_v3/skin.json (scripts/pets/godot/make_skin_mesh_v3.py 가 생성)
class_name SkinRigV3
extends RefCounted

const FPS := 30.0
const LEGS := ["leg_hind_near", "leg_hind_far", "leg_front_far", "leg_front_near"]

static func load_tex(dir: String, file: String) -> Texture2D:
	return ImageTexture.create_from_image(Image.load_from_file(ProjectSettings.globalize_path(dir.path_join(file))))

static func build(dir: String) -> Node2D:
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join("skin.json")))
	var origin := Vector2(d["origin"][0], d["origin"][1])
	var pet := Node2D.new()
	pet.name = "Pet"
	pet.set_meta("skin", d)
	var sk := Skeleton2D.new()
	sk.name = "Skeleton"
	pet.add_child(sk)
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
	# 메시 (그리는 순서: 반대편 다리 → 몸통(머리·꼬리 포함) → 가까운 다리)
	var order := ["leg_hind_far", "leg_front_far", "body", "leg_hind_near", "leg_front_near"]
	for pn in order:
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
		pet.add_child(poly)
		poly.skeleton = poly.get_path_to(sk)
		for bn in part["weights"]:
			poly.add_bone(NodePath(String(sk.get_path_to(bones[bn]))), PackedFloat32Array(part["weights"][bn]))
	var ap := AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	pet.add_child(ap)
	var lib := AnimationLibrary.new()
	lib.add_animation("walk", anim_walk(pet, d, origin, bones))
	ap.add_animation_library("", lib)
	return pet

# ───────────────────────── 걷기 ─────────────────────────
## 네발 동물 걷기(측대 순서 walk): 뒷다리(가까운) → 앞다리(가까운) → 뒷다리(먼) → 앞다리(먼), 각 1/4 주기 간격.
## 각 다리는 주기의 62% 동안 바닥을 짚고(발이 바닥에 고정된 채 몸 뒤로 밀림), 38% 동안 들어 올려 앞으로 옮긴다.
## 발 위치를 먼저 정하고 2관절 IK 로 엉덩이·무릎 각도를 계산 → 발이 미끄러지거나 바닥을 뚫지 않는다.
const CYCLE := 1.0          # 한 주기(초)
const DUTY := 0.62          # 바닥을 짚는 비율
const STRIDE := 18.0        # 보폭 (원본 px)
const CROUCH := 2.0         # 다리에 여유를 주려고 몸을 살짝 낮춤 (원본 px)
const PHASE := {"leg_hind_near": 0.0, "leg_front_near": 0.25, "leg_hind_far": 0.5, "leg_front_far": 0.75}
## 발 중심은 '다리를 곧게 폈을 때 바닥에 닿는 위치' 근처로 잡아 무릎이 과하게 접히지 않게 한다
const FOOT := {             # 발 중심 x, 바닥 y, 들어올림 (원본 px)
	"leg_hind_near": [66.0, 275.0, 7.0], "leg_hind_far": [158.0, 276.0, 6.0],
	"leg_front_far": [201.0, 277.0, 7.0], "leg_front_near": [313.0, 272.0, 8.0]}

## 걷는 속도 (HD px/초) — 게임에서 캐릭터를 이 속도로 이동시키면 바닥을 짚은 발이 제자리에 고정된다
static func walk_speed(k: float) -> float:
	return STRIDE * k / (DUTY * CYCLE)

static func foot_target(n: String, u: float, k: float, off: float) -> Vector2:
	var f: Array = FOOT[n]
	var cx: float = f[0]
	var gy: float = f[1]
	var x: float
	var y: float = gy
	if u < DUTY:
		x = cx + STRIDE / 2.0 - STRIDE * (u / DUTY)
	else:
		var s := (u - DUTY) / (1.0 - DUTY)
		var e := s * s * (3.0 - 2.0 * s)
		x = cx - STRIDE / 2.0 + STRIDE * e
		y = gy - float(f[2]) * sin(PI * s)
	return Vector2((x + off) * k, (y + off) * k)

static func anim_walk(pet: Node2D, d: Dictionary, origin: Vector2, bones: Dictionary) -> Animation:
	var k: float = d["k"]
	var off: float = d["off"]
	var a := Animation.new()
	a.resource_name = "walk"
	a.length = CYCLE
	a.loop_mode = Animation.LOOP_LINEAR
	a.step = 1.0 / FPS
	var tracks := {}
	var body: Bone2D = bones["body"]
	var body_rest: Vector2 = body.position
	var n_frames := int(round(CYCLE * FPS))
	for fi in n_frames + 1:
		var t := fi / FPS
		var ph := TAU * t / CYCLE
		# 몸통: 한 주기에 두 번 살짝 오르내림 + 앞뒤로 아주 약한 기울기
		var bob := (CROUCH + 1.1 * cos(2.0 * ph)) * k
		var pitch := 0.010 * sin(ph)
		var bpos: Vector2 = body_rest + Vector2(0, bob)
		_key(a, tracks, "Skeleton/body:position", t, bpos)
		_key(a, tracks, "Skeleton/body:rotation", t, pitch)
		# 머리: 몸이 내려갈 때 살짝 들어 균형 (반대 방향 미세 끄덕임) / 꼬리: 걸음에 맞춰 늦게 따라오는 흔들림
		_key(a, tracks, "Skeleton/body/head:rotation", t, -0.018 * cos(2.0 * ph + 0.5) + 0.012 * sin(ph))
		_key(a, tracks, "Skeleton/body/tail:rotation", t, 0.10 * sin(ph - 0.9) + 0.025 * sin(2.0 * ph - 0.4))
		var bx := Transform2D(pitch, bpos)
		for n in LEGS:
			var u: float = fposmod(t / CYCLE + float(PHASE[n]), 1.0)
			var target_sk: Vector2 = foot_target(n, u, k, off) - origin       # 스켈레톤 좌표
			var tl: Vector2 = bx.affine_inverse() * target_sk          # 몸통 뼈 좌표
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
			# 뒷다리는 무릎이 앞으로, 앞다리는 팔꿈치가 뒤로 굽도록
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
			_key(a, tracks, "Skeleton/body/%s:rotation" % n, t, r_up)
			_key(a, tracks, "Skeleton/body/%s/%s_lower:rotation" % [n, n], t, r_low)
	return a

static func _key(a: Animation, tracks: Dictionary, path: String, t: float, v) -> void:
	if not tracks.has(path):
		var i := a.add_track(Animation.TYPE_VALUE)
		a.track_set_path(i, NodePath(path))
		a.track_set_interpolation_type(i, Animation.INTERPOLATION_LINEAR)
		a.value_track_set_update_mode(i, Animation.UPDATE_CONTINUOUS)
		tracks[path] = i
	a.track_insert_key(tracks[path], t, v)
