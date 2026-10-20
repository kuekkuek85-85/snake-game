# 🐍 스네이크 게임 (정보 수업용)

중학교 정보 수업에서 학생들이 직접 플레이하는 **PC 웹 기반 스네이크 게임**입니다.
한 판이 끝나면 **학번·성명·점수가 Firebase Firestore에 저장**되고,
**대시보드에서 우리 반 전체의 순위를 실시간으로 확인**할 수 있습니다.

> 정보 수업용 스네이크 게임 PRD(v1.0) 기반 구현

## 주요 기능

- **시작 화면**: 학번(`학년-반-번호` 형식)·성명 입력, 유효성 검사
- **게임**: 20×15 격자 보드, 방향키/WASD 조작, 반대 방향 즉시 전환 금지
- **사과·점수**: 빈 칸 랜덤 생성, 먹으면 몸 1칸 성장 + 점수 +1
- **충돌/게임오버**: 벽·자기 몸 충돌 처리
- **기록 저장**: 게임 오버 시 Firestore에 학번·성명·점수·시각 저장
- **다시 하기**: 같은 학생 정보로 재시작
- **사운드 on/off** (WebAudio 합성, 외부 파일 불필요)
- **속도 증가**: 점수가 오를수록 뱀 이동 속도 상승
- **일시정지**: 스페이스바
- **실시간 대시보드**: `bestScore` 내림차순 순위표, 내 행 하이라이트, 반별 필터, 1~3위 메달

## 파일 구조

```
.
├─ index.html            # 시작 / 게임 / 게임오버 화면
├─ dashboard.html        # 실시간 순위 대시보드
├─ css/style.css
├─ js/
│  ├─ game.js            # 게임 엔진(이동·충돌·렌더링, 순수 로직)
│  ├─ main.js            # 화면 전환 / 입력 / 저장 오케스트레이션
│  ├─ db.js              # Firestore 연동(players / scores)
│  ├─ dashboard.js       # 대시보드 실시간 구독
│  ├─ sound.js           # 효과음(WebAudio)
│  └─ firebase-config.js # Firebase 프로젝트 설정 (채워 넣어야 함)
├─ firestore.rules       # 보안 규칙 예시
└─ firebase.json         # Firebase Hosting + Firestore 설정
```

## 실행 방법 (로컬)

ES 모듈을 사용하므로 `file://`로 직접 열면 동작하지 않습니다. 간단한 정적 서버로 실행하세요.

```bash
# Python
python3 -m http.server 8080
# 또는 Node
npx serve .
```

브라우저에서 `http://localhost:8080` 접속.

> Firebase를 설정하지 않아도 **게임은 로컬로 동작**합니다(기록 저장/대시보드만 비활성화).

## Firebase 연동

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Firestore Database** 활성화
3. 프로젝트 설정 → 웹 앱 등록 → SDK 설정값 복사
4. `js/firebase-config.js`의 `firebaseConfig` 값을 교체
5. (권장) `firestore.rules`를 배포:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### Firestore 데이터 구조

**`players/{학번}`** — 학생별 최고 기록 1건

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `studentId` | string | 학번 (예: `1-3-07`) |
| `name` | string | 성명 |
| `className` | string | 반 (예: `1-3`), 대시보드 필터용 |
| `bestScore` | number | 개인 최고 점수 |
| `playCount` | number | 플레이 횟수 |
| `updatedAt` | timestamp | 최고 기록 갱신 시각 |

**`scores/{자동ID}`** — 모든 플레이 로그(보조)

최고 기록 갱신은 트랜잭션으로 처리하여, 현재 점수가 기존 `bestScore`보다 높을 때만
`bestScore`/`updatedAt`을 갱신하고 `playCount`는 매판 +1 합니다.

## 배포 (Firebase Hosting)

```bash
firebase deploy --only hosting
```

또는 Vercel 등 정적 호스팅에 그대로 올려도 됩니다.

## 개인정보·보안

- **최소 수집**: 학번·성명·점수만 수집 (생년월일·연락처 등 금지)
- **목적 제한**: 수업 내 순위 확인 용도, 학기/차시 종료 후 교사가 초기화
- **공개 범위**: 링크 비공개 공유 또는 인증으로 같은 수업 학생·교사만 접근
- 운영 시 점수 상한(10000) 검증 + 가능하면 Anonymous Auth 추가 권장

## 조작

| 키 | 동작 |
| --- | --- |
| 방향키 / WASD | 상하좌우 이동 |
| 스페이스바 | 일시정지 / 재개 |
