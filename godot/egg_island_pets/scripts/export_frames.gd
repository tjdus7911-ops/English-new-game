## 헤드리스(가상 디스플레이) 내보내기: godot --path . -s res://scripts/export_frames.gd
## 1) scenes/ice_leopard_s1.tscn 저장 (편집기에서 열어 수정 가능)
## 2) 애니메이션별 PNG 프레임 → export/frames/<anim>/NNN.png (미리보기·검수용)
## 3) 웹 게임용 데이터 → export/ice_leopard_s1.anim.json (파츠별 프레임 변환 행렬 · 표시 여부)
extends SceneTree

const PARTS := "res://parts/ice_leopard_s1"
const CANVAS := {"idle": Vector2i(640, 760), "walk": Vector2i(860, 720), "run": Vector2i(860, 720),
	"pet_react": Vector2i(640, 760), "nuzzle": Vector2i(1000, 780)}

func _initialize() -> void:
	_run.call_deferred()

func _own(n: Node, owner_node: Node) -> void:
	for c in n.get_children():
		c.owner = owner_node
		_own(c, owner_node)

func _run() -> void:
	var pet := PetRigBuilder.build_pet(PARTS)
	# 장면 저장 (텍스처는 파일로 다시 연결되도록 리소스 경로를 쓰지 않고 내장)
	_own(pet, pet)
	var ps := PackedScene.new()
	ps.pack(pet)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://scenes"))
	ResourceSaver.save(ps, "res://scenes/ice_leopard_s1.tscn")

	var vp := SubViewport.new()
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_2d = Viewport.MSAA_4X
	root.add_child(vp)
	vp.add_child(pet)
	var ap: AnimationPlayer = pet.get_node("AnimationPlayer")
	var data := {"pet": "PET_SNOW_C", "slug": "ice_leopard", "stage": 1, "fps": PetRigBuilder.FPS, "parts": {}, "anims": {}}
	var sprites: Array[Sprite2D] = []
	_collect(pet, sprites)
	for s in sprites:
		var key := _key(pet, s)
		data["parts"][key] = {"file": s.texture.resource_path if s.texture.resource_path != "" else "", "w": s.texture.get_width(), "h": s.texture.get_height(), "z": s.z_index}
	var only := OS.get_environment("ANIMS")
	for anim_name in ["idle", "walk", "run", "pet_react", "nuzzle"]:
		if only != "" and not only.split(",").has(anim_name):
			continue
		var size: Vector2i = CANVAS[anim_name]
		vp.size = size
		pet.position = Vector2(size.x / 2.0, size.y - 36)
		var a := ap.get_animation(anim_name)
		var n := int(round(a.length * PetRigBuilder.FPS))
		if a.loop_mode == Animation.LOOP_NONE:
			n += 1
		var dir := "res://export/frames/%s" % anim_name
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
		ap.play(anim_name)
		ap.pause()
		var frames := []
		for i in n:
			ap.seek(i / PetRigBuilder.FPS, true)
			await process_frame
			await RenderingServer.frame_post_draw
			var img := vp.get_texture().get_image()
			img.save_png(ProjectSettings.globalize_path("%s/%03d.png" % [dir, i]))
			var fr := {}
			for s in sprites:
				if not s.is_visible_in_tree():
					continue
				var xf: Transform2D = pet.get_global_transform().affine_inverse() * s.get_global_transform()
				xf = xf * Transform2D(0.0, s.offset)
				fr[_key(pet, s)] = [snappedf(xf.x.x, 0.0001), snappedf(xf.x.y, 0.0001), snappedf(xf.y.x, 0.0001), snappedf(xf.y.y, 0.0001), snappedf(xf.origin.x, 0.01), snappedf(xf.origin.y, 0.01)]
			frames.append(fr)
		data["anims"][anim_name] = {"loop": a.loop_mode != Animation.LOOP_NONE, "length": a.length, "canvas": [size.x, size.y], "origin": [size.x / 2.0, size.y - 36], "frames": frames}
		print("rendered ", anim_name, " ", n)
	var f := FileAccess.open("res://export/ice_leopard_s1.anim.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(data))
	f.close()
	quit()

func _collect(n: Node, out: Array[Sprite2D]) -> void:
	for c in n.get_children():
		if c is Sprite2D:
			out.append(c)
		_collect(c, out)

func _key(pet: Node, s: Sprite2D) -> String:
	var p := String(pet.get_path_to(s))
	return p.replace("/spr", "").replace("/body/", "/").replace("Close/", "")
