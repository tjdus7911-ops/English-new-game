## 원본 포즈에서 분리한 파츠(parts/<pet>/rig.json)로 Skeleton2D·Bone2D 리그와 AnimationPlayer 를 만든다.
## 캐릭터 그림은 원본 픽셀 그대로 — 움직임은 뼈(Bone2D) 변형으로만 만든다.
class_name PetRigBuilder
extends RefCounted

const FPS := 30.0

static func load_tex(dir: String, file: String) -> Texture2D:
	var img := Image.load_from_file(ProjectSettings.globalize_path(dir.path_join(file)))
	return ImageTexture.create_from_image(img)

## rig: rig.json 의 한 리그(walk/idle/pet_react). 원점 = 발밑 가운데
static func build_skeleton(dir: String, rig: Dictionary, sk_name: String) -> Skeleton2D:
	var sk := Skeleton2D.new()
	sk.name = sk_name
	var parts: Array = rig["parts"]
	var canvas: Array = rig["canvas"]
	var origin := Vector2(canvas[0] / 2.0, rig["ground_y"])
	var bones := {}
	var pivots := {}
	for p in parts:
		var b := Bone2D.new()
		b.name = p["name"]
		b.set_autocalculate_length_and_angle(false)
		b.set_length(12.0)
		var piv := Vector2(p["pivot"][0], p["pivot"][1])
		pivots[p["name"]] = piv
		var parent_name = p["parent"]
		if parent_name == null:
			b.position = piv - origin
			sk.add_child(b)
		else:
			b.position = piv - pivots[parent_name]
			bones[parent_name].add_child(b)
		b.rest = b.transform
		var s := Sprite2D.new()
		s.name = "spr"
		s.texture = load_tex(dir, p["file"])
		s.centered = false
		s.offset = Vector2(p["pos"][0], p["pos"][1]) - piv
		s.z_index = int(p["z"])
		s.z_as_relative = false
		if int(p["z"]) < 0 and String(p["name"]).begins_with("leg_"):
			s.modulate = Color(0.86, 0.88, 0.94)  # 몸 뒤쪽 다리는 살짝 그늘 (깊이감 + 절단선 완화)
		s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		b.add_child(s)
		bones[p["name"]] = b
	return sk

static func build_pet(dir: String) -> Node2D:
	var rig: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join("rig.json")))
	var pet := Node2D.new()
	pet.name = "Pet"
	pet.add_child(build_skeleton(dir, rig["walk"], "WalkRig"))
	pet.add_child(build_skeleton(dir, rig["idle"], "IdleRig"))
	pet.add_child(build_skeleton(dir, rig["pet_react"], "ReactRig"))
	var close := Node2D.new()
	close.name = "Close"
	pet.add_child(close)
	for n in ["cl_notice_approach", "cl_closeup", "cl_rub_cheek", "cl_gaze_back_off"]:
		var s := Sprite2D.new()
		s.name = n
		s.texture = load_tex(dir, rig["closeup"][n]["file"])
		var sz: Array = rig["closeup"][n]["size"]
		var bottom: bool = n == "cl_notice_approach" or n == "cl_gaze_back_off"
		s.centered = false
		s.offset = Vector2(-sz[0] / 2.0, -sz[1]) if bottom else Vector2(-sz[0] / 2.0, -sz[1] / 2.0)
		s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		s.z_index = 20
		s.z_as_relative = false
		close.add_child(s)
	capture_rest(pet)
	var ap := AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	pet.add_child(ap)
	var lib := AnimationLibrary.new()
	for a in [anim_idle(), anim_walk(), anim_run(), anim_pet_react(), anim_nuzzle()]:
		lib.add_animation(a.resource_name, a)
	ap.add_animation_library("", lib)
	return pet

# ───────────────────────── 애니메이션 (프레임마다 키를 굽는다) ─────────────────────────
class Baker:
	var anim: Animation
	var tracks := {}
	func _init(name: String, length: float, loop: bool) -> void:
		anim = Animation.new()
		anim.resource_name = name
		anim.length = length
		anim.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
		anim.step = 1.0 / FPS
	func key(path: String, t: float, v) -> void:
		if not tracks.has(path):
			var i := anim.add_track(Animation.TYPE_VALUE)
			anim.track_set_path(i, NodePath(path))
			anim.track_set_interpolation_type(i, Animation.INTERPOLATION_LINEAR)
			anim.value_track_set_update_mode(i, Animation.UPDATE_CONTINUOUS if typeof(v) != TYPE_BOOL else Animation.UPDATE_DISCRETE)
			tracks[path] = i
		anim.track_insert_key(tracks[path], t, v)
	func frames() -> int:
		return int(round(anim.length * FPS))

const W := "WalkRig/body"

static func rig_vis(b: Baker, t: float, walk: bool, idle: bool, react: bool, close: Array) -> void:
	b.key("WalkRig:visible", t, walk)
	b.key("IdleRig:visible", t, idle)
	b.key("ReactRig:visible", t, react)
	var names := ["cl_notice_approach", "cl_closeup", "cl_rub_cheek", "cl_gaze_back_off"]
	for i in names.size():
		b.key("Close/%s:visible" % names[i], t, close[i])

## 대기: 숨쉬기(몸통 스케일), 머리 살짝 기울이기, 꼬리 흔들기
static func anim_idle() -> Animation:
	var b := Baker.new("idle", 3.0, true)
	for f in b.frames() + 1:
		var t := f / FPS
		var p := TAU * t / 3.0
		rig_vis(b, t, false, true, false, [false, false, false, false])
		var br := sin(p) * 0.5 + 0.5
		b.key("IdleRig/body:scale", t, Vector2(1.0 + br * 0.008, 1.0 - br * 0.018))
		b.key("IdleRig/body/head:rotation", t, sin(p) * 0.035)
		b.key("IdleRig/body/head:position", t, idle_head_rest() + Vector2(0, -br * 3.0))
		b.key("IdleRig/body/tail:rotation", t, sin(p * 2.0) * 0.10)
	return b.anim

static var _idle_head_rest := Vector2.ZERO
static func idle_head_rest() -> Vector2:
	return _idle_head_rest

## 걷기: 대각선 다리 쌍이 번갈아 앞뒤로 (앞발·뒷발 교차), 앞으로 내딛는 다리는 살짝 들어 올림.
## 몸통은 한 걸음마다 위아래, 머리는 반대로 미세 보정, 꼬리는 흔들림.
static func anim_walk() -> Animation:
	var L := 0.9
	var b := Baker.new("walk", L, true)
	for f in b.frames() + 1:
		var t := f / FPS
		var p := TAU * t / L
		rig_vis(b, t, true, false, false, [false, false, false, false])
		var legs := {"leg_front_near": -1.0, "leg_hind_far": -1.0, "leg_front_far": 1.0, "leg_hind_near": 1.0}
		for n in legs:
			var sgn: float = legs[n]
			var amp := 0.32 if n.begins_with("leg_front") else 0.27
			b.key("%s/%s:rotation" % [W, n], t, sgn * sin(p) * amp)
			var lift := maxf(0.0, -sgn * cos(p)) * 9.0  # 앞으로 내딛는 동안 들어 올림
			b.key("%s/%s:position" % [W, n], t, walk_rest(n) + Vector2(0, -lift))
		b.key(W + ":position", t, walk_rest("body") + Vector2(0, -absf(sin(p)) * 7.0))
		b.key(W + ":rotation", t, sin(p) * 0.018)
		b.key(W + "/head:rotation", t, -sin(p * 2.0) * 0.022)
		b.key(W + "/tail:rotation", t, sin(p) * 0.13)
	return b.anim

## 달리기: 앞다리 한 쌍·뒷다리 한 쌍이 크게 모였다 펴짐(갤럽), 몸통이 앞뒤로 기울며 뜀·착지, 꼬리·머리 흔들림
static func anim_run() -> Animation:
	var L := 0.56
	var b := Baker.new("run", L, true)
	for f in b.frames() + 1:
		var t := f / FPS
		var p := TAU * t / L
		rig_vis(b, t, true, false, false, [false, false, false, false])
		b.key(W + "/leg_front_near:rotation", t, -sin(p) * 0.62)
		b.key(W + "/leg_front_far:rotation", t, -sin(p - 0.55) * 0.58)
		b.key(W + "/leg_hind_near:rotation", t, sin(p) * 0.55)
		b.key(W + "/leg_hind_far:rotation", t, sin(p - 0.55) * 0.52)
		for n in ["leg_front_near", "leg_front_far", "leg_hind_near", "leg_hind_far"]:
			var ph := 0.0 if n.ends_with("near") else -0.55
			var lift := maxf(0.0, cos(p + ph)) * 12.0 if n.begins_with("leg_front") else maxf(0.0, -cos(p + ph)) * 12.0
			b.key("%s/%s:position" % [W, n], t, walk_rest(n) + Vector2(0, -lift))
		var air := sin(p) * 0.5 + 0.5
		b.key(W + ":position", t, walk_rest("body") + Vector2(sin(p) * 6.0, -air * 26.0))
		b.key(W + ":rotation", t, -cos(p) * 0.075)
		b.key(W + ":scale", t, Vector2(1.0 + sin(p) * 0.035, 1.0 - sin(p) * 0.02))
		b.key(W + "/head:rotation", t, cos(p) * 0.05)
		b.key(W + "/tail:rotation", t, -0.18 + sin(p) * 0.22)
	return b.anim

## 쓰다듬기 반응: 대기 → 눈 감고 고개 들어 손에 머리를 비비는 포즈(원본) → 좌우로 비비기 → 대기
static func anim_pet_react() -> Animation:
	var L := 2.4
	var b := Baker.new("pet_react", L, false)
	for f in b.frames() + 1:
		var t := f / FPS
		var react := t >= 0.14 and t < 2.26
		rig_vis(b, t, false, not react, react, [false, false, false, false])
		var u := clampf((t - 0.14) / 2.1, 0.0, 1.0)
		var w := sin(TAU * (t - 0.14) / 0.62)
		b.key("ReactRig/body/head:rotation", t, w * 0.075 * sin(PI * u))
		b.key("ReactRig/body/head:position", t, react_head_rest() + Vector2(w * 6.0 * sin(PI * u), -absf(w) * 3.0))
		b.key("ReactRig/body:scale", t, Vector2(1.0 + absf(w) * 0.01, 1.0 - absf(w) * 0.02))
		b.key("IdleRig/body:scale", t, Vector2(1.0, 1.0 - (0.03 if t < 0.14 else 0.0) * t / 0.14))
		b.key("IdleRig/body/head:rotation", t, 0.0)
		b.key("IdleRig/body/head:position", t, idle_head_rest())
	return b.anim

static var _react_head_rest := Vector2.ZERO
static func react_head_rest() -> Vector2:
	return _react_head_rest

## 부비부비: 발견(고개 갸웃·깡충) → 카메라 쪽으로 다가옴(걸음 리듬) → 얼굴 클로즈업 → 눈 감고 볼 비비기 →
## 잠시 머물렀다 뒤로 물러나 원래 자리로. 근접 전용 원본 4장 사용, 원본 해상도를 넘겨 확대하지 않음.
static func anim_nuzzle() -> Animation:
	var L := 6.6
	var b := Baker.new("nuzzle", L, false)
	var CL := "Close/"
	for f in b.frames() + 1:
		var t := f / FPS
		var s_app := 0.0; var s_cl := 0.0; var s_rub := 0.0; var s_back := 0.0
		var idle := t < 0.5 or t >= 6.2
		# 1) 발견: 고개 기울이고 살짝 뜀
		var hop := sin(PI * clampf((t - 0.15) / 0.3, 0.0, 1.0))
		b.key("IdleRig/body/head:rotation", t, 0.11 * sin(PI * clampf(t / 0.5, 0.0, 1.0)) if t < 0.5 else 0.0)
		b.key("IdleRig/body/head:position", t, idle_head_rest())
		b.key("IdleRig/body:scale", t, Vector2.ONE)
		b.key("IdleRig/body:position", t, idle_body_rest() + Vector2(0, -hop * 14.0 if t < 0.5 else 0.0))
		# 2) 다가오기 0.5–1.95
		if t >= 0.5 and t < 1.95:
			s_app = 1.0
		var ua := ease_io(clampf((t - 0.5) / 1.45, 0.0, 1.0))
		var step := sin(TAU * 2.0 * clampf((t - 0.5) / 1.45, 0.0, 1.0))
		b.key(CL + "cl_notice_approach:scale", t, Vector2.ONE * lerpf(0.62, 1.0, ua))
		b.key(CL + "cl_notice_approach:position", t, Vector2(0, -absf(step) * 10.0))
		b.key(CL + "cl_notice_approach:rotation", t, step * 0.035)
		# 3) 클로즈업 1.95–2.85 (원본 크기 그대로, 아주 약한 숨쉬기)
		if t >= 1.95 and t < 2.85:
			s_cl = 1.0
		var uc := clampf((t - 1.95) / 0.9, 0.0, 1.0)
		b.key(CL + "cl_closeup:scale", t, Vector2.ONE * lerpf(0.94, 1.0, ease_io(uc)))
		b.key(CL + "cl_closeup:position", t, Vector2(0, -360))
		b.key(CL + "cl_closeup:rotation", t, sin(PI * uc) * 0.025)
		# 4) 볼 비비기 2.85–4.8 (좌우 기울이며 비빔, 눌림)
		if t >= 2.85 and t < 4.8:
			s_rub = 1.0
		var ur := clampf((t - 2.85) / 1.95, 0.0, 1.0)
		var rw := sin(TAU * (t - 2.85) / 0.65) * sin(PI * ur)
		b.key(CL + "cl_rub_cheek:rotation", t, rw * 0.07)
		b.key(CL + "cl_rub_cheek:position", t, Vector2(rw * 22.0, -360 + absf(rw) * 6.0))
		b.key(CL + "cl_rub_cheek:scale", t, Vector2(1.0 + absf(rw) * 0.012, 1.0 - absf(rw) * 0.02))
		# 5) 물러나기 4.8–6.2
		if t >= 4.8 and t < 6.2:
			s_back = 1.0
		var ub := ease_io(clampf((t - 4.8) / 1.4, 0.0, 1.0))
		var bstep := sin(TAU * 2.0 * clampf((t - 4.8) / 1.4, 0.0, 1.0))
		b.key(CL + "cl_gaze_back_off:scale", t, Vector2.ONE * lerpf(1.0, 0.6, ub))
		b.key(CL + "cl_gaze_back_off:position", t, Vector2(0, -absf(bstep) * 8.0))
		b.key(CL + "cl_gaze_back_off:rotation", t, bstep * 0.03)
		rig_vis(b, t, false, idle, false, [s_app > 0.0, s_cl > 0.0, s_rub > 0.0, s_back > 0.0])
	return b.anim

static var _idle_body_rest := Vector2.ZERO
static func idle_body_rest() -> Vector2:
	return _idle_body_rest

static var _walk_rest := {}
static func walk_rest(n: String) -> Vector2:
	return _walk_rest.get(n, Vector2.ZERO)

static func ease_io(x: float) -> float:
	return x * x * (3.0 - 2.0 * x)

## 애니메이션 생성 전에 휴지 위치를 기록 (위치 트랙이 원래 자리 기준으로 움직이도록)
static func capture_rest(pet: Node2D) -> void:
	var wb: Node2D = pet.get_node("WalkRig/body")
	_walk_rest["body"] = wb.position
	for c in wb.get_children():
		if c is Bone2D:
			_walk_rest[c.name] = c.position
	_idle_head_rest = pet.get_node("IdleRig/body/head").position
	_idle_body_rest = pet.get_node("IdleRig/body").position
	_react_head_rest = pet.get_node("ReactRig/body/head").position
