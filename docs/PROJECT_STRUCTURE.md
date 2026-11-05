# EGG ISLAND — 프로젝트 구조

## 1. 잘못 가져왔다가 정리한 것 (2026-11-05)

이 저장소에 영어 학습·집 꾸미기 게임(`english-game-2`) 전체를 복사해 넣었던 작업을 되돌렸습니다. **원본 저장소는 수정·삭제하지 않았습니다.**

| 구분 | 내용 | 조치 |
|---|---|---|
| 앱 코드 | `src/` 126개 파일 (영어 학습 화면, 저택·거실 장면, 별 보상, 저장소) | 삭제 |
| 이미지·미디어 | `public/` 1,804개 (거실 배경·가구·캐릭터·음성·영상), `art/` 368개 | 삭제 |
| 기타 | `android/`, `docs/`, `tests/`, `e2e/`, `qa/`, `scripts/`(기존 15개), 설정 파일 | 삭제 |
| 분석용 이미지 | 거실 배경 격자 이미지(`scene_grid.png`) — 작업 폴더에만 있었고 저장소에는 없음 | 삭제 |

합계 2,444개 파일. 펫 시스템 코드는 기존 게임에 한 줄도 연결되지 않은 상태에서 중단했습니다.
복사본은 커밋 기록(최초 6개 커밋)에 남아 있습니다 — 기록까지 지우려면 별도 승인 후 처리합니다.

## 2. 폴더

```
art/pets/source/          Figma 원본 시트 33개 (편집 원본)
scripts/pets/
  build_pet_assets.py     원본 → 배경 제거 → 단계별 아틀라스 + atlas.json
  check_assets.mjs        27종×3단계 누락·미사용 프레임 검사
public/assets/pets/
  {slug}/s1|s2|s3.webp    단계별 아틀라스 (키포즈 32장)
  {slug}/lineup.webp      도감용 성장 라인업
  eggs/{attr}.webp        속성 공통 알 9종
  fire_fox/extra/         턴어라운드 15 · 진화 키프레임 4 · 감정 아이콘 9
src/
  pets/generated/atlas.json   프레임 좌표·발밑 기준점·불투명(클로즈업) 표시
  data/species.ts         9속성 · 27종 (ID 규칙 PET_{ATTR}_{A|B|C})
  data/motions.ts         행동 ID → 프레임 · 반복/일회성 · 다음 동작 · 우선순위
  data/config.ts          부화 확률 · 경험치 · 진화 조건 · 재화 (전부 임시값)
  data/save.ts            저장 데이터 (IndexedDB 'egg-island', 키 'save-v1')
docs/                     구조 · 화면 구성안 · 애니메이션 계획
```

## 3. 등록된 펫 에셋

- 27종 × 3단계 = 81개 아틀라스, 프레임 2,592장 (단계마다 32장)
  - 기본 10: idle · walk · run · sit · sleep · wake_up · jump · turn · look_around · eat
  - 감정 10: happy · sad · love · yawn · tilt · surprise · excited · angry · curious · shy
  - 상호작용 8: pet_react · feed_run · toy_play · follow_light · drowsy_rest · celebrate · cheer · 속성 특수(unique_01)
  - 근접 교감 4: notice_approach · closeup · rub_cheek · gaze_back_off
- 알 9종, 성장 라인업 27장, 불꽃 여우 전용 28장
- 개요 이미지: `docs/img/pets_overview.webp`

## 4. 분리 원칙
- 다른 프로젝트의 코드·에셋·UI·저장 키를 가져오거나 참조하지 않는다.
- 재화(코인·먹이)와 저장소는 이 게임 전용.
- 배포: Vite 정적 빌드(`base: './'`) — 독립 사이트로 배포.
