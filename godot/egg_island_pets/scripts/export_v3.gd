## v3 스키닝 리그 내보내기: godot --path . -s res://scripts/export_v3.gd   (ANIMS=walk,run 처럼 골라서 가능)
## 1) scenes/ice_leopard_s1_v3.tscn
## 2) export/frames/ice_leopard_s1_v3/<anim>/NNN.png (투명 배경, 모션별 fps)
## 3) export/ice_leopard_s1_v3.anims.json (모션별 fps·프레임 수·캔버스·발밑 원점·이동 속도)
extends SceneTree

const BASE := "res://parts/ice_leopard_s1_v3"
## 모션별: 캔버스 크기, 발밑 원점 y(아래에서), 내보내기 fps
const SPEC := {
	"walk": [Vector2i(900, 700), 40, 30.0], "run": [Vector2i(900, 720), 40, 30.0],
	"idle": [Vector2i(640, 760), 30, 15.0], "pet_react": [Vector2i(640, 760), 30, 20.0],
	"nuzzle": [Vector2i(1000, 820), 30, 15.0]}

func _initialize() -> void:
	_run.call_deferred()

func _own(n: Node, o: Node) -> void:
	for c in n.get_children():
		c.owner = o
		_own(c, o)

func _run() -> void:
	var pet := SkinRigV3.build(BASE)
	_own(pet, pet)
	var ps := PackedScene.new()
	ps.pack(pet)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://scenes"))
	ResourceSaver.save(ps, "res://scenes/ice_leopard_s1_v3.tscn")
	var vp := SubViewport.new()
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	vp.add_child(pet)
	var ap: AnimationPlayer = pet.get_node("AnimationPlayer")
	var only := OS.get_environment("ANIMS")
	var info := {}
	var k := 2.0
	for name in SPEC:
		if only != "" and not only.split(",").has(name):
			continue
		var spec: Array = SPEC[name]
		var size: Vector2i = spec[0]
		var fps: float = spec[2]
		vp.size = size
		pet.position = Vector2(size.x / 2.0, size.y - int(spec[1]))
		var a := ap.get_animation(name)
		var n := int(round(a.length * fps))
		if a.loop_mode == Animation.LOOP_NONE:
			n += 1
		var dir := "res://export/frames/ice_leopard_s1_v3/%s" % name
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
		ap.play(name)
		ap.pause()
		for i in n:
			ap.seek(minf(i / fps, a.length), true)
			await process_frame
			await process_frame
			await RenderingServer.frame_post_draw
			vp.get_texture().get_image().save_png(ProjectSettings.globalize_path("%s/%03d.png" % [dir, i]))
		var speed := 0.0
		if name == "walk":
			speed = SkinRigV3.gait_speed(SkinRigV3.WALK, k)
		elif name == "run":
			speed = SkinRigV3.gait_speed(SkinRigV3.RUN, k)
		info[name] = {"fps": fps, "frames": n, "length": a.length, "loop": a.loop_mode != Animation.LOOP_NONE,
			"canvas": [size.x, size.y], "origin": [size.x / 2.0, size.y - int(spec[1])], "speed_px_s": speed}
		print("rendered ", name, " ", n)
	var f := FileAccess.open("res://export/ice_leopard_s1_v3.anims.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(info, "\t"))
	f.close()
	quit()
