## v3 스키닝 리그 내보내기: godot --path . -s res://scripts/export_v3.gd
## 1) scenes/ice_leopard_s1_v3.tscn  2) export/frames/ice_leopard_s1_v3/walk/NNN.png (투명 배경)
## 3) export/ice_leopard_s1_v3.walk.json (프레임 수·fps·걷기 속도 — 게임 이동 속도 맞춤용)
extends SceneTree

const DIR := "res://parts/ice_leopard_s1_v3"
const SIZE := Vector2i(900, 700)

func _initialize() -> void:
	_run.call_deferred()

func _own(n: Node, o: Node) -> void:
	for c in n.get_children():
		c.owner = o
		_own(c, o)

func _run() -> void:
	var pet := SkinRigV3.build(DIR)
	_own(pet, pet)
	var ps := PackedScene.new()
	ps.pack(pet)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://scenes"))
	ResourceSaver.save(ps, "res://scenes/ice_leopard_s1_v3.tscn")
	var vp := SubViewport.new()
	vp.transparent_bg = true
	vp.size = SIZE
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_2d = Viewport.MSAA_4X
	root.add_child(vp)
	vp.add_child(pet)
	pet.position = Vector2(SIZE.x / 2.0, SIZE.y - 40)
	var ap: AnimationPlayer = pet.get_node("AnimationPlayer")
	var a := ap.get_animation("walk")
	var n := int(round(a.length * SkinRigV3.FPS))
	var dir := "res://export/frames/ice_leopard_s1_v3/walk"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	ap.play("walk")
	ap.pause()
	for i in n:
		ap.seek(i / SkinRigV3.FPS, true)
		await process_frame
		await process_frame
		await RenderingServer.frame_post_draw
		vp.get_texture().get_image().save_png(ProjectSettings.globalize_path("%s/%03d.png" % [dir, i]))
	var skin: Dictionary = pet.get_meta("skin")
	var info := {"fps": SkinRigV3.FPS, "frames": n, "cycle": SkinRigV3.CYCLE, "canvas": [SIZE.x, SIZE.y],
		"ground_origin": [SIZE.x / 2.0, SIZE.y - 40], "walk_speed_px_s": SkinRigV3.walk_speed(skin["k"])}
	var f := FileAccess.open("res://export/ice_leopard_s1_v3.walk.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(info))
	f.close()
	print("rendered walk ", n, " speed ", info["walk_speed_px_s"])
	quit()
