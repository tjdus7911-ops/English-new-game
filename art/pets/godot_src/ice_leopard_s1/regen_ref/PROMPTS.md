# 설표 1단계 — 리깅용 파츠 시트 생성 프롬프트

ChatGPT 또는 Gemini에 참고 이미지 한 장을 첨부하고, 아래 프롬프트를 그대로 붙여 넣는다.
결과 이미지를 받아 그대로 전달하면 파츠 분리·배경 제거·크기 맞춤·Godot 리깅은 자동으로 처리한다.

## 1) 옆모습 파츠 (걷기·달리기용) — 첨부: ref_side_walk.png

```
Use the attached image as the exact character reference: a chibi snow leopard cub in a soft 3D cartoon style.
Keep exactly the same character design: the same face, big glossy blue eyes, pink nose, white fluffy fur,
dark blue-gray rosette spots, the dark fluffy tail tip, the same colors and the same body proportions.

Create a game animation PARTS SHEET of this same character in a strict side view facing right,
on a plain pure white background. Draw each body part as a separate, complete piece,
with clear empty white space between the pieces (no piece may touch or overlap another):

1. The head with a short neck, facing right.
2. The torso only: no head, no legs, no tail. The belly underside is fully drawn and rounded,
   with a rounded neck stump at the front and a rounded rump at the back.
3. One front leg, side view, straight and relaxed, with a rounded fur-covered shoulder at the top and the paw at the bottom.
4. One hind leg, side view, straight and relaxed, with a rounded fur-covered hip at the top and the paw at the bottom.
5. The tail alone, gently curved upward, with a rounded fur-covered base.

Every piece must be complete: also draw the parts that are normally hidden behind other body parts.
Joint ends (neck, shoulders, hips, tail base) must be rounded and covered with fur, never cut flat.
All pieces at the same scale as the reference. No ground shadow, no outlines, no text, no labels.
```

## 2) 정면 파츠 (대기·쓰다듬기용) — 첨부: ref_front_sit.png

```
Use the attached image as the exact character reference: a chibi snow leopard cub in a soft 3D cartoon style.
Keep exactly the same character design: the same face, big glossy blue eyes, pink nose, white fluffy fur,
dark blue-gray rosette spots, the dark fluffy tail, the same colors and the same body proportions.

Create a game animation PARTS SHEET of this same character in the same front view, sitting,
on a plain pure white background. Draw each part as a separate, complete piece,
with clear empty white space between the pieces (no piece may touch or overlap another):

1. The head, front view, with the chin, cheeks and a short rounded neck stub fully drawn.
2. The sitting body, front view, without the head and without the tail:
   the neck and upper chest fully drawn and rounded on top, with the chest, front legs and paws.
3. The tail alone, the same fluffy curled tail, with a rounded fur-covered base.

Every piece must be complete: also draw the parts that are normally hidden behind other body parts.
Joint ends must be rounded and covered with fur, never cut flat.
All pieces at the same scale as the reference. No ground shadow, no outlines, no text, no labels.
```
