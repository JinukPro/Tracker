# Tracker

SW 프로젝트 일정(이슈) 트래커 — Firebase Auth/Firestore + GitHub Pages.

여러 프로젝트를 등록하고 상단 프로젝트 칩을 클릭해 원하는 프로젝트들만 골라 함께 볼 수 있습니다(달력·간트·타임라인 등 모든 화면에 통합 표시). 프로젝트 관리는 **설정** 페이지에서 합니다.

Planner와 **같은 Firebase Spark 프로젝트**를 쓸 수 있습니다. 컬렉션이 분리되어 있어 데이터가 섞이지 않습니다.

| 앱 | 주요 컬렉션 |
|----|-------------|
| Tracker | `trackerIssues`, `trackerProjects`, `users` |
| Planner | `leaves`, `trips`, `plans`, `meetings`, `watchCategories`, `users` |

---

## 1. Firebase 프로젝트 만들기

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. **프로젝트 추가** (이름 예: `tracker` — Project ID는 자유롭게)
3. Google Analytics는 선택 사항
4. 요금제 **Spark(무료)** 유지 — 카드 등록·Blaze 업그레이드 하지 않음

---

## 2. 웹 앱 등록

1. 프로젝트 홈 → **웹(`</>`)** 앱 추가
2. 닉네임 예: `Tracker` (Firebase Hosting 체크 불필요)
3. 표시되는 SDK 설정값을 복사 (`apiKey`, `authDomain`, `projectId` 등)
4. 나중에 다시 보려면: ⚙️ **프로젝트 설정** → **내 앱**

---

## 3. Authentication

1. **Build → Authentication → Get started**
2. **Sign-in method → Google → 사용 설정**
3. **프로젝트 지원 이메일**: 로그인 중인 Google 계정(또는 팀 공용 메일) 선택 후 저장

---

## 4. Firestore

1. **Build → Firestore Database → Create database**
2. 위치: 가까운 리전 (예: `asia-northeast3` 서울) — 생성 후 변경 어려움
3. 시작 모드: **프로덕션 모드** 권장
4. **Rules** 탭에 이 리포 루트 `firestore.rules` 전체를 붙여넣고 **Publish**

Rules는 Planner + Tracker 합본입니다. Console에는 **한 번만** 배포하면 두 앱 모두 적용됩니다.

CLI로 배포할 때:

```bash
npx firebase login
npx firebase use <projectId>
npx firebase deploy --only firestore
```

Planner 휴가 조회용 복합 인덱스가 필요하면 Console 에러 링크에서 생성하거나 `firestore.indexes.json`을 함께 배포하세요.

---

## 5. 환경 변수

`.env.example`을 복사해 `.env`(로컬) / `.env.production`(배포)를 만듭니다.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

VITE_BASE=/Tracker/
```

- 값이 채워지면 앱이 자동으로 **Firestore** 모드로 동작합니다.
- 비우면 개발 시 `data/issues.json`·`data/projects.json`, 그 외에는 localStorage 폴백입니다.
- Planner도 **같은** `VITE_FIREBASE_*` 값을 쓰면 됩니다.

로컬 실행:

```bash
npm install
npm run dev
```

---

## 6. Authorized domains (GitHub Pages)

1. Authentication → **Settings** → **Authorized domains**
2. Pages 호스트 추가 (예: `jinukpro.github.io`)
3. Planner를 다른 도메인에 배포하면 그 도메인도 추가
4. `localhost`는 기본 포함

---

## 7. GitHub Pages 배포

1. 레포 **Settings → Pages → Source: GitHub Actions**
2. `.env.production`을 커밋한 뒤 `main`에 푸시  
   → `.github/workflows/deploy-pages.yml`이 빌드·배포
3. 또는 로컬: `npm run deploy`
4. 접속 예: `https://<user>.github.io/Tracker/`

---

## 확인 체크리스트

- [ ] Google 로그인 성공
- [ ] 설정 페이지 저장소가 **Firebase Firestore**
- [ ] 이슈 추가 후 Console → `trackerIssues`에 문서 생성
- [ ] (Planner 동시 사용 시) 휴가/일정 등도 같은 프로젝트에 저장·조회됨

기존 `issues.json` / localStorage 데이터는 설정 → **JSON 내보내기** 후 Firestore 모드에서 **JSON 가져오기**로 옮길 수 있습니다.
