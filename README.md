# EGG ISLAND

속성 알을 모아 부화시키고, 펫을 먹이고 쓰다듬고 놀아 주며 3단계로 진화시켜 도감을 완성하는 **펫 육성 게임**입니다.

다른 프로젝트(영어 학습·집 꾸미기 게임 등)와 코드·에셋·저장 데이터·UI를 공유하지 않는 **독립 프로젝트**입니다.

## 현재 상태

- ✅ 펫 에셋 등록: 9속성 · 27종 · 3단계 · 단계별 32개 키포즈 (Figma 원본 → 배경 제거 아틀라스)
- ✅ 데이터 구조: 종 등록부, 모션 등록부, 밸런스 설정(임시값), 저장 데이터 타입
- ✅ 확정 시안 14개 화면 UI (`docs/UI_STATUS.md`)
- ✅ 상태 기반 애니메이션·자유 이동 런타임 (`src/pets`)

## 폴더

```
art/pets/source/        Figma 원본 시트 (편집 원본)
scripts/pets/           에셋 빌드(build_pet_assets.py) · 에셋 검사(check_assets.mjs)
public/assets/pets/     게임용 에셋 (아틀라스 · 알 · 라인업 · 불꽃 여우 전용)
src/pets/generated/     atlas.json — 프레임 좌표·발밑 기준점 (빌드 산출물)
src/data/               species.ts · motions.ts · config.ts · save.ts
docs/                   구조 · 화면 구성안 · 애니메이션 계획
```

## 명령

```bash
pip install rembg onnxruntime scipy pillow   # 에셋 빌드에만 필요
npm run assets:pets    # art/pets/source → public/assets/pets + atlas.json
npm run assets:check   # 누락·미사용 프레임 검사
```
