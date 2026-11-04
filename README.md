# snowcrab-3d

Opus 5.5와 Three.js(r170)로 외부 모델·에셋 없이 코드만으로 만든 인터랙티브 대게(Chionoecetes opilio) 3D.

| 버전 | 내용 | 링크 |
|---|---|---|
| v1 | 바다 바닥 걷기 (WASD 게걸음, 클릭 집게) | https://artreachkorea.github.io/snowcrab-3d/v1/ |
| v2 | 사실형 표본 뷰어 (집게 개폐, 다리 개별 움직임) | https://artreachkorea.github.io/snowcrab-3d/v2/ |
| v3 | 분해 시뮬레이터 (분리/조립, 정보 패널, 자동 투어) | https://artreachkorea.github.io/snowcrab-3d/v3/ |
| v4 | teardown 콘솔 (사진 9장 기반, 다리 IK, 실시간 계기판, 분해·뒤집기·집게·속도, 커서 자동 투어) | https://artreachkorea.github.io/snowcrab-3d/v4/ |

각 폴더의 `index.html` 하나로 동작하며 브라우저에서 바로 열 수 있습니다.

v4는 [elvarofficial/teardown](https://github.com/elvarofficial/teardown) 스킬(MIT)의 kit과 규칙으로 만들었습니다. 원본 소스는 `v4/src/`에 있고, 스킬 레포의 `sims/` 아래에 두고 `node sims/build.mjs snowcrab-live`로 빌드합니다.
