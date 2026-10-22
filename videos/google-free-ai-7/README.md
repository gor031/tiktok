# 무료 구글 AI 7가지 — 소개 숏폼 (1080×1920, 58.5초)

결과물: [`out/video.mp4`](out/video.mp4) · 세로 9:16 · 30fps · H.264 + AAC 48kHz · −14 LUFS

주제 출처: 어나더 AI 「AI 영상 제작부터 디자인까지 모두 무료인 구글 AI 도구 7가지」 (https://youtu.be/ayfGFE-YN6A)

## 구성

| 시간 | 장면 |
|---|---|
| 0:00–0:03.5 | 훅 — "잠깐!" → AI 구독료 결제하기 전에 → 구글 무료 AI **7가지** |
| 0:03.5–0:49 | 도구 7개 × 6.5초 — 번호·이름·카테고리, **실제 사이트 화면**(URL 입력 → 로딩 → 스크롤·커서·클릭), 핵심 설명 2줄, 무료 범위 스티커 |
| 0:49–0:55 | 한 번에 정리 (카테고리 → 도구) |
| 0:55–0:58.5 | 엔딩 — "결제 전에 무료부터!" + 무료 범위·한도는 정책에 따라 바뀔 수 있다는 안내 |

| # | 도구 | 카테고리 | 화면에 나오는 사이트 |
|---|---|---|---|
| 1 | Stitch | 디자인 | https://stitch.withgoogle.com/ |
| 2 | Pomelli | 마케팅 | https://labs.google.com/pomelli/about/ |
| 3 | Opal | 앱 만들기 | https://opal.google/landing/ |
| 4 | Gemini Notebook (구 NotebookLM) | 자료 정리 | https://notebook.google.com/ |
| 5 | Say What You See | 프롬프트 연습 | https://artsandculture.google.com/experiment/say-what-you-see/jwG3m7wQShZngw |
| 6 | Google Vids | 영상 편집 | https://workspace.google.com/intl/ko/products/vids/ |
| 7 | Google Flow | AI 영상 | https://flow.google.com |

Opal 공식 페이지 배너에 있는 안내("2026년 11월 17일 Labs 종료, Gemini의 skills로 이전")를 영상에 함께 넣었습니다.

## 사이트 화면은 어떻게 넣었나

`assets/sites/*.jpg`는 2026-10-22에 원격 헤드리스 브라우저(Firecrawl)로 각 공식 사이트에 실제로 접속해 찍은 1280px 폭의 전체 페이지 캡처입니다.
영상 안의 브라우저 창은 이 캡처를 카메라(스크롤·줌)로 훑고, 그 위에 커서 이동·클릭 효과를 얹어 화면 녹화처럼 보이게 합니다.
이 작업 환경의 네트워크 정책이 구글 도메인 직접 접속을 막아서, 브라우저 실시간 녹화 대신 실제 페이지 캡처 방식을 썼습니다.
영상 속 페이지 모습은 모두 실제 사이트이고, 페이지 안의 움직임(동영상 재생, 호버 애니메이션)은 담기지 않았습니다.

## 만든 방법 (참고한 Opus 5.5 영상 레포의 방식)

`mg-styles-15`, `ClaudeAnimationBase`, `lemo-opuscar` 등과 같은 "코드로 찍는 영상" 방식입니다.

- `index.html` — 영상 한 편이 웹페이지 하나. `window.renderAt(t)`가 임의의 시각 t의 프레임을 그립니다 (결정론적, 모든 모션은 t의 순수 함수).
- `render.mjs` — 헤드리스 Chromium(Playwright)으로 프레임마다 `renderAt` → 스크린샷 → ffmpeg로 MP4 합성.
- `audio.py` — 음악(120BPM, vi–IV–I–V)과 효과음(휙·팝·클릭·타자·딩)을 numpy로 합성. `cues.json`(페이지가 내보낸 큐 시트)을 읽어서 화면의 동작과 소리가 같은 시각에 납니다.
- `make.sh` — 큐 시트 → 사운드 → 라우드니스 마스터링(−14 LUFS) → 렌더 → 합본.

```bash
cd videos/google-free-ai-7
./make.sh                                        # → out/video.mp4
node render.mjs --stills 2.6,8.2,21 --scale 0.5  # 키프레임 확인용 스틸
```

필요한 것: Node 18+, Playwright(+Chromium), Python 3 + numpy, ffmpeg.

## 수정하기

- 도구별 문구·색·URL·스크롤/커서 동선: `index.html`의 `TOOLS` 배열 (`cam`: 카메라 키프레임 `[t, cx, cy, zoom]`, `cur`: 커서 `[t, x, y]`, 좌표는 캡처 이미지 픽셀 기준).
- 장면 길이: `INTRO`, `TOOL`, `RECAP`, `OUTRO` 상수.
- 내레이션은 없습니다(자막+음악). 보이스오버를 쓰려면 TTS 파일을 `out/audio.wav`에 믹스한 뒤 `node render.mjs`를 다시 실행하세요.

## 크레딧

- 폰트: Pretendard (OFL-1.1), Black Han Sans (OFL-1.1, `assets/fonts/LICENSE-BlackHanSans.txt`)
- 사이트 화면: 각 서비스의 공식 페이지 (© Google). 소개·리뷰 목적으로 사용.
