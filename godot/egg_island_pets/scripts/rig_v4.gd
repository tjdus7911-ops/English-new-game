## 설표 1단계 v4 리그 — 리깅용으로 새로 그린 파츠(머리·몸통·앞다리·뒷다리·꼬리)를 '단단한' 층으로만 움직인다.
## 그림을 휘지 않으므로 늘어남·찢어짐이 없다. 관절 끝은 원래 둥근 털로 그려져 있어 회전해도 절단면이 없다.
##   Side  : 옆모습 (걷기·달리기)   Front : 정면 앉은 자세 (대기·쓰다듬기, 부비부비 시작·끝)
##   Close : 근접 교감 원본 4장 (부비부비)
## 데이터: parts/ice_leopard_s1_v4/{side,front}/layout.json (scripts/pets/godot/assemble_v4.py export)
class_name RigV4
extends RefCounted

const FPS := 30.0
const LEGS := ["leg_hind_near", "leg_hind_far", "leg_front_far", "leg_front_near"]
const VIEWS := ["Side", "Front", "Close"]
const CLOSE := ["cl_notice_approach", "cl_closeup", "cl_rub_cheek", "cl_gaze_back_off"]
const BASE := "res://parts/ice_leopard_s1_v4"

static func load_tex(path: String) -> Texture2D:
	return ImageTexture.create_from_image(Image.load_from_file(ProjectSettings.globalize_path(path)))

## layout.json → 관절(Node2D) 계층 + 파츠 스프라이트. 원점 = 발밑 가운데
static func build_view(view: String, node_name: String) -> Node2D:
	var dir := BASE.path_join(view)
	var lay: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join("layout.json")))
	var root := Node2D.new()
	root.name = node_name
	var joints := {}
	var parts: Dictionary = lay["parts"]
	# 부모부터 만든다
	var names := parts.keys()
	names.sort_custom(func(a, b): return parts[a]["parent"] == null and parts[b]["parent"] != null)
	for n in names:
		var p: Dictionary = parts[n]
		var j := Node2D.new()
		j.name = n
		var piv := Vector2(p["pivot"][0], p["pivot"][1])
		if p["parent"] == null:
			j.position = piv
			root.add_child(j)
		else:
			var par: Dictionary = parts[p["parent"]]
			j.position = piv - Vector2(par["pivot"][0], par["pivot"][1])
			joints[p["parent"]].add_child(j)
		j.rotation = p["rot"]
		var s := Sprite2D.new()
		s.name = "spr"
		s.texture = load_tex(dir.path_join(p["file"]))
		s.centered = false
		s.offset = Vector2(p["offset"][0], p["offset"][1])
		s.z_index = int(p["z"])
		s.z_as_relative = false
		s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		j.add_child(s)
		joints[n] = j
	root.set_meta("joints", joints)
	return root

static func build() -> Node2D:
	var pet := Node2D.new()
	pet.name = "Pet"
	var side := build_view("side", "Side")
	var front := build_view("front", "Front")
	pet.add_child(side)
	pet.add_child(front)
	# 하트 (쓰다듬기 반응) — 원본 반응 포즈에 그려져 있던 하트
	var heart := Sprite2D.new()
	heart.name = "Heart"
	heart.texture = load_tex("res://parts/ice_leopard_s1_v3_react/heart.png")
	heart.position = Vector2(110, -640)
	heart.z_index = 30
	pet.add_child(heart)
	# 근접 교감 원본 4장
	var close := Node2D.new()
	close.name = "Close"
	pet.add_child(close)
	var cdir := "res://parts/ice_leopard_s1"
	var crig: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(cdir.path_join("rig.json")))
	for n in CLOSE:
		var s := Sprite2D.new()
		s.name = n
		s.texture = load_tex(cdir.path_join(crig["closeup"][n]["file"]))
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
	lib.add_animation("walk", anim_gait("walk", side, WALK))
	lib.add_animation("run", anim_gait("run", side, RUN))
	lib.add_animation("idle", anim_idle(front))
	lib.add_animation("pet_react", anim_react(front))
	lib.add_animation("nuzzle", anim_nuzzle(front))
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
			var stepped := typeof(v) == TYPE_BOOL or typeof(v) == TYPE_COLOR
			a.track_set_interpolation_type(i, Animation.INTERPOLATION_NEAREST if stepped else Animation.INTERPOLATION_LINEAR)
			a.value_track_set_update_mode(i, Animation.UPDATE_DISCRETE if stepped else Animation.UPDATE_CONTINUOUS)
			tracks[path] = i
		a.track_insert_key(tracks[path], t, v)
	func frames() -> int:
		return int(round(a.length * FPS))

static func show(b: Baker, t: float, view: String) -> void:
	for v in VIEWS:
		b.key(v + ":visible", t, v == view)
	b.key("Heart:visible", t, false)

static func ease_io(x: float) -> float:
	x = clampf(x, 0.0, 1.0)
	return x * x * (3.0 - 2.0 * x)

static func pop(t: float, t0: float) -> float:
	if t < t0 or t > t0 + 0.16:
		return 1.0
	var u := (t - t0) / 0.16
	return 1.0 - 0.07 * (1.0 - u) * (1.0 - u)

static func jp(view: Node2D, n: String) -> String:
	## 관절 노드 경로 (예: Side/torso/leg_front_near)
	var joints: Dictionary = view.get_meta("joints")
	return String(view.name) + "/" + String(view.get_path_to(joints[n]))

static func rest(view: Node2D, n: String) -> Node2D:
	return view.get_meta("joints")[n]

static func leg_len(view: Node2D, n: String) -> float:
	var spr: Sprite2D = rest(view, n).get_node("spr")
	return spr.texture.get_height() + spr.offset.y - 14.0

# ───────────────────────── 걷기 · 달리기 ─────────────────────────
## 다리는 단단한 막대처럼 엉덩이·어깨를 축으로 돈다. 바닥을 짚는 동안 발이 일정한 속도로 뒤로 밀리고(=몸이 앞으로 감),
## 드는 동안 다리를 살짝 들어 올려 앞으로 옮긴다. 걷기: 뒷다리(가까운)→앞다리(가까운)→뒷다리(먼)→앞다리(먼)
const WALK := {"cycle": 1.0, "duty": 0.62, "stride": 124.0, "lift": 26.0,
	"phase": {"leg_hind_near": 0.0, "leg_front_near": 0.25, "leg_hind_far": 0.5, "leg_front_far": 0.75},
	"bob": 3.0, "pitch": 0.012, "head": 0.03, "tail": 0.12, "tail_base": 0.0, "air": 0.0}
## 달리기(갤럽): 뒷다리 두 개가 차고 → 공중 → 앞다리 두 개가 받는다
const RUN := {"cycle": 0.5, "duty": 0.32, "stride": 150.0, "lift": 36.0,
	"phase": {"leg_hind_near": 0.0, "leg_hind_far": 0.9, "leg_front_near": 0.5, "leg_front_far": 0.4},
	"bob": 0.0, "pitch": 0.07, "head": 0.05, "tail": 0.18, "tail_base": -0.18, "air": 22.0}

static func gait_speed(p: Dictionary) -> float:
	return float(p["stride"]) / (float(p["duty"]) * float(p["cycle"]))

static func anim_gait(name: String, side: Node2D, p: Dictionary) -> Animation:
	var L: float = p["cycle"]
	var b := Baker.new(name, L, true)
	var torso_rest: Vector2 = rest(side, "torso").position
	var head_rest: Vector2 = rest(side, "head").position
	var tail_rot: float = rest(side, "tail").rotation
	for fi in b.frames() + 1:
		var t := fi / FPS
		var u0 := t / L
		var ph := TAU * u0
		show(b, t, "Side")
		var y_off := float(p["bob"]) * (0.5 + 0.5 * cos(2.0 * ph))
		var pitch := float(p["pitch"]) * sin(ph)
		if float(p["air"]) > 0.0:
			var lift := pow(maxf(0.0, cos(TAU * (u0 - 0.45))), 3.0) + pow(maxf(0.0, cos(TAU * (u0 - 0.95))), 3.0)
			y_off = -float(p["air"]) * lift
			pitch = -float(p["pitch"]) * sin(TAU * (u0 - 0.05))
		b.key(jp(side, "torso") + ":position", t, torso_rest + Vector2(0, y_off))
		b.key(jp(side, "torso") + ":rotation", t, pitch)
		b.key(jp(side, "head") + ":rotation", t, -pitch * 0.8 + float(p["head"]) * sin(2.0 * ph + 0.6))
		b.key(jp(side, "head") + ":position", t, head_rest + Vector2(0, -0.6 * y_off))
		b.key(jp(side, "tail") + ":rotation", t, tail_rot + float(p["tail_base"]) + float(p["tail"]) * sin(ph - 0.9))
		var duty: float = p["duty"]
		var S: float = p["stride"]
		for n in LEGS:
			var j := rest(side, n)
			var u: float = fposmod(u0 + float(p["phase"][n]), 1.0)
			var dx: float
			var up := 0.0
			if u < duty:
				dx = S / 2.0 - S * (u / duty)
			else:
				var s := (u - duty) / (1.0 - duty)
				dx = -S / 2.0 + S * ease_io(s)
				up = float(p["lift"]) * sin(PI * s)
			var Ll := leg_len(side, n)
			# 몸통이 기울고 오르내려도 발이 바닥선에 오도록 각도·높이 보정
			var th := -asin(clampf(dx / Ll, -0.9, 0.9)) - pitch
			b.key(jp(side, n) + ":rotation", t, th)
			b.key(jp(side, n) + ":position", t, j.position + Vector2(0, -up - y_off * 0.9))
	return b.a

# ───────────────────────── 대기 ─────────────────────────
static func idle_pose(b: Baker, t: float, front: Node2D) -> void:
	var ph := TAU * t / 3.0
	var br := sin(ph) * 0.5 + 0.5
	b.key("Front:scale", t, Vector2(1.0 + br * 0.006, 1.0 + br * 0.012))
	b.key(jp(front, "head") + ":rotation", t, 0.04 * sin(ph) + 0.01 * sin(2.0 * ph + 1.0))
	b.key(jp(front, "head") + ":position", t, rest(front, "head").position + Vector2(0, -br * 2.0))
	b.key(jp(front, "tail") + ":rotation", t, rest(front, "tail").rotation + 0.09 * sin(2.0 * ph - 0.6))

static func anim_idle(front: Node2D) -> Animation:
	var b := Baker.new("idle", 3.0, true)
	for fi in b.frames() + 1:
		var t := fi / FPS
		show(b, t, "Front")
		idle_pose(b, t, front)
	return b.a

# ───────────────────────── 쓰다듬기 반응 ─────────────────────────
## 고개를 살짝 들고 좌우로 기울이며 손에 머리를 비빈다. 몸도 같이 흔들리고, 꼬리를 빠르게 살랑, 하트가 떠오른다
static func anim_react(front: Node2D) -> Animation:
	var L := 2.6
	var b := Baker.new("pet_react", L, false)
	var hr: Vector2 = rest(front, "head").position
	for fi in b.frames() + 1:
		var t := fi / FPS
		show(b, t, "Front")
		var env := sin(PI * clampf((t - 0.15) / 2.25, 0.0, 1.0))
		var w := sin(TAU * (t - 0.15) / 0.62)
		b.key("Front:scale", t, Vector2(1.0 + absf(w) * 0.008 * env, 1.0 - absf(w) * 0.014 * env))
		b.key("Front:rotation", t, w * 0.025 * env)
		b.key(jp(front, "head") + ":rotation", t, w * 0.10 * env)
		b.key(jp(front, "head") + ":position", t, hr + Vector2(w * 8.0 * env, -10.0 * env - absf(w) * 3.0 * env))
		b.key(jp(front, "tail") + ":rotation", t, rest(front, "tail").rotation + 0.16 * sin(TAU * t / 0.45) * env)
		var hu := clampf((t - 0.45) / 1.3, 0.0, 1.0)
		var pp := 1.0 + 0.25 * sin(PI * clampf(hu / 0.25, 0.0, 1.0))
		b.key("Heart:visible", t, t >= 0.45 and t <= 1.75)
		b.key("Heart:position", t, Vector2(110, -640) + Vector2(12.0 * sin(TAU * hu), -70.0 * hu))
		b.key("Heart:scale", t, Vector2.ONE * minf(1.0, hu / 0.12) * pp)
		b.key("Heart:modulate", t, Color(1, 1, 1, 1.0 - ease_io((hu - 0.6) / 0.4)))
	return b.a

# ───────────────────────── 부비부비 ─────────────────────────
static func anim_nuzzle(front: Node2D) -> Animation:
	var L := 6.8
	var b := Baker.new("nuzzle", L, false)
	var C := "Close/"
	for fi in b.frames() + 1:
		var t := fi / FPS
		var a_front := t < 0.6 or t >= 6.4
		var al := [t >= 0.6 and t < 2.0, t >= 2.0 and t < 2.9, t >= 2.9 and t < 4.85, t >= 4.85 and t < 6.4]
		show(b, t, "Front" if a_front else "Close")
		for i in CLOSE.size():
			b.key(C + CLOSE[i] + ":visible", t, al[i])
		idle_pose(b, t, front)
		var hop := sin(PI * clampf((t - 0.15) / 0.3, 0.0, 1.0))
		b.key(jp(front, "head") + ":rotation", t, 0.12 * sin(PI * clampf(t / 0.55, 0.0, 1.0)) if t < 0.6 else 0.04 * sin(TAU * t / 3.0))
		b.key("Front:position", t, Vector2(0, -hop * 14.0 if t < 0.6 else 0.0))
		if t >= 6.4:
			var q := pop(t, 6.4)
			b.key("Front:scale", t, Vector2(2.0 - q, q))
		var ua := ease_io(clampf((t - 0.6) / 1.4, 0.0, 1.0))
		var st := sin(TAU * 2.0 * clampf((t - 0.6) / 1.4, 0.0, 1.0))
		b.key(C + "cl_notice_approach:scale", t, Vector2.ONE * lerpf(1.08, 1.26, ua) * pop(t, 0.6))
		b.key(C + "cl_notice_approach:position", t, Vector2(0, -absf(st) * 10.0))
		b.key(C + "cl_notice_approach:rotation", t, st * 0.03)
		var uc := clampf((t - 2.0) / 0.9, 0.0, 1.0)
		b.key(C + "cl_closeup:scale", t, Vector2.ONE * lerpf(0.97, 1.0, ease_io(uc)) * pop(t, 2.0))
		b.key(C + "cl_closeup:position", t, Vector2(0, -380.0))
		b.key(C + "cl_closeup:rotation", t, sin(PI * uc) * 0.02)
		var ur := clampf((t - 2.9) / 1.95, 0.0, 1.0)
		var rw := sin(TAU * (t - 2.9) / 0.66) * sin(PI * ur)
		b.key(C + "cl_rub_cheek:rotation", t, rw * 0.06)
		b.key(C + "cl_rub_cheek:position", t, Vector2(rw * 20.0, -380.0 + absf(rw) * 6.0))
		b.key(C + "cl_rub_cheek:scale", t, Vector2(1.0 + absf(rw) * 0.012, 1.0 - absf(rw) * 0.02) * pop(t, 2.9))
		var ub := ease_io(clampf((t - 4.85) / 1.55, 0.0, 1.0))
		var bs := sin(TAU * 2.0 * clampf((t - 4.85) / 1.55, 0.0, 1.0))
		b.key(C + "cl_gaze_back_off:scale", t, Vector2.ONE * lerpf(1.36, 1.22, ub) * pop(t, 4.85))
		b.key(C + "cl_gaze_back_off:position", t, Vector2(0, -absf(bs) * 8.0))
		b.key(C + "cl_gaze_back_off:rotation", t, bs * 0.025)
	return b.a
