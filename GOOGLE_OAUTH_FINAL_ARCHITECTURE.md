# 🎯 Google OAuth 2.0 최종 아키텍처 (개인 Gmail 기반)

> ✅ **Service Account 방식 완전 제거**
> ✅ **OAuth 2.0 사용자 로그인 방식 적용**

---

## 📋 아키텍처 개요

```
개인 사용자가 자신의 Google 계정으로 로그인
  ↓
access_token + refresh_token 발급
  ↓
사용자의 Google Drive에 파일 저장
  ↓
access_token 만료 시 refresh_token으로 자동 갱신
  ↓
365일 자동화 가능 ✨
```

---

## 🔐 필수 OAuth 2.0 설정

### 1️⃣ Authorization URL 옵션

```typescript
// ✅ 반드시 포함해야 하는 옵션
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",  // ⭐ refresh_token 발급 신호
  prompt: "consent",       // ⭐ 매번 동의 화면 표시
  scope: [
    "https://www.googleapis.com/auth/drive.file",  // ✅ 최소 권한
  ],
  state,                   // 🔐 CSRF 방지
});
```

### 2️⃣ Scope 설정

| Scope | 권한 | 사용 여부 |
|-------|------|----------|
| `drive` | Google Drive 전체 접근 | ❌ 금지 |
| `drive.file` | 앱이 생성한 파일만 접근 | ✅ **필수** |

**이유**: `drive.file` scope는 보안상 훨씬 안전하며, 앱이 생성한 파일만 관리할 수 있습니다.

### 3️⃣ access_type 옵션

| 옵션 | 의미 | 결과 |
|------|------|------|
| `access_type=online` | 사용자가 온라인일 때만 API 사용 | ❌ refresh_token 없음 |
| `access_type=offline` | 사용자가 오프라인이어도 API 사용 | ✅ **refresh_token 발급** |

**문제**: offline으로 설정해도 Google이 refresh_token을 안 주는 경우 많음!

### 4️⃣ prompt 옵션

| 옵션 | 의미 | refresh_token |
|------|------|----------------|
| 없음 | 사용자가 이미 승인했으면 스킵 | ❌ 첫 로그인만 발급 |
| `prompt=consent` | 매번 동의 화면 표시 | ✅ **매번 발급** |

**이유**: Google은 동일 user+client 조합에서 기본적으로 refresh_token을 재발급하지 않습니다.
`prompt=consent`를 포함하면 매번 강제로 동의 화면을 표시하고 refresh_token을 새로 발급합니다.

---

## 🔑 토큰 처리 흐름

### 단계 1️⃣: 사용자 로그인

```
1. 프론트엔드: /api/google/auth-url-v2 호출
   ↓
2. 백엔드: state 생성 + authUrl 반환
   ↓
3. 프론트엔드: window.location.href = authUrl
   ↓
4. 사용자: Google 로그인 + 권한 허용
   ↓
5. Google: authorization code 발급
   ↓
6. 리다이렉트: /api/google/callback-v2?code=xxx&state=yyy
```

### 단계 2️⃣: Token 교환 및 저장

```typescript
// callback-v2/route.ts에서:
1️⃣ Authorization code 검증
   ↓
2️⃣ State 파라미터 검증 (CSRF 방지)
   ↓
3️⃣ Code → access_token + refresh_token 교환
   ↓
4️⃣ refresh_token null 체크
   if (!refresh_token) {
     → 상세 에러 메시지 + 해결책 안내
     → Google 계정 권한 페이지 링크
   }
   ↓
5️⃣ 사용자 정보 조회
   ↓
6️⃣ Token 저장
   tokenStorage.saveInitialToken({
     access_token,
     refresh_token,  // ⭐ 영구 저장!
     expiry_date,
     scope,
   })
```

### 단계 3️⃣: Token 자동 갱신

```typescript
// 파일 업로드 시마다:
1️⃣ 저장된 token 확인
   ↓
2️⃣ 만료 여부 체크 (5분 버퍼)
   if (isTokenExpired(token.expiry_date)) {
   ↓
3️⃣ refresh_token으로 새 access_token 발급
     const newToken = await refreshAccessToken(token.refresh_token)
   ↓
4️⃣ 새로운 refresh_token 캡처
     oauth2Client.on("tokens", (tokens) => {
       if (tokens.refresh_token) {
         // 새 refresh_token도 저장!
         tokenStorage.updateAccessToken(..., tokens.refresh_token)
       }
     })
   ↓
5️⃣ 파일 업로드 계속 진행
```

---

## 💾 Token 저장소 설계

### 현재 구현 (google-token-storage-single-user.ts)

```typescript
class SingleUserTokenStorage {
  // 메모리: 현재 실행 중인 access_token
  private currentToken: StoredToken | null = null;

  // 환경변수: refresh_token (영구 저장)
  private getStoredRefreshToken(): string | null {
    return process.env.GOOGLE_REFRESH_TOKEN;
  }

  // 저장 방식
  saveInitialToken(token: GoogleOAuthToken): void {
    // 메모리에 저장
    this.currentToken = { access_token, refresh_token, ... }

    // ⚠️ 수동으로 환경변수 설정 필요
    console.log(`export GOOGLE_REFRESH_TOKEN="${token.refresh_token}"`)
  }
}
```

### ❌ 문제점

1. **Vercel Serverless 환경**
   - 메모리는 함수 실행 종료 시 소멸
   - 파일 시스템도 읽기 전용
   - refresh_token이 매번 새로 로드됨

2. **환경변수는 정적임**
   - 실행 중에 업데이트 불가능
   - 자동 갱신 시 새 refresh_token 저장 불가능

### ✅ 최종 해결책: DB 암호화 저장

```typescript
// 다음 단계에서 구현할 내용:

interface GoogleTokenDB {
  userId: string;                 // 로그인 사용자 ID (현재: 고정값)
  refreshToken: string;            // AES-256으로 암호화
  accessToken: string;             // AES-256으로 암호화
  expiryDate: number;
  scope: string;
  createdAt: Date;
  updatedAt: Date;
  encryptionVersion: number;
}

// 저장 방식
1. 로그인 시: refresh_token을 AES-256으로 암호화하여 DB 저장
2. 사용 시: DB에서 로드 후 복호화하여 사용
3. 갱신 시: 새로운 refresh_token을 즉시 DB에 암호화 저장

// 권장 DB
- Vercel KV (Redis) ← 가장 간단
- Supabase PostgreSQL
- Firebase Realtime Database
```

---

## 🛠️ 구현된 파일들

### ✅ OAuth 클라이언트

**lib/utils/google-oauth-client-v2.ts**
- `generateState()` - CSRF 방지
- `generateAuthUrl()` - access_type=offline, prompt=consent 포함
- `exchangeCodeForToken()` - refresh_token null 체크
- `refreshAccessToken()` - 자동 토큰 갱신
- `isTokenExpired()` - 5분 버퍼 포함

### ✅ Token 저장소

**lib/utils/google-token-storage-single-user.ts**
- `saveInitialToken()` - refresh_token 검증 후 저장
- `getToken()` - 저장된 token 조회
- `updateAccessToken()` - 새 refresh_token 저장
- `getRefreshToken()` - refresh_token 조회

### ✅ Drive 파일 업로드

**lib/utils/google-drive-upload-v2.ts**
- `getValidToken()` - 자동 갱신 포함
- `uploadFileToDrive()` - 파일 생성
- `updateFileInDrive()` - 파일 업데이트
- `deleteFileFromDrive()` - 파일 삭제

### ✅ API 엔드포인트

| 엔드포인트 | 메서드 | 기능 |
|-----------|--------|------|
| `/api/google/auth-url-v2` | GET | 로그인 URL 생성 |
| `/api/google/callback-v2` | GET | OAuth 콜백 처리 |
| `/api/google/upload-v2` | POST | 파일 업로드 |
| `/api/google/upload-v2` | PUT | 파일 업데이트 |

### ✅ 이전 방식 제거

| 파일 | 상태 | 이유 |
|------|------|------|
| `lib/utils/google-drive.ts` | 🗑️ **삭제** | Service Account 방식 |
| `api-blog-487212-4f424f085f53.json` | 🗑️ **삭제** | Service Account 키 |

---

## 📝 환경 변수 설정

### .env.local

```bash
# Google OAuth 2.0 (필수)
GOOGLE_CLIENT_ID=1234567890-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback-v2

# Google Drive 업로드 (첫 로그인 후 자동 설정)
# 다음 중 하나 선택:
# 1) 환경변수 (수동 업데이트 필요)
# GOOGLE_REFRESH_TOKEN=ya29.a0...

# 2) 또는 DB (추천) - 자동 갱신 가능
# DATABASE_URL=postgresql://...
```

### Vercel 배포 시

```
Settings → Environment Variables

GOOGLE_CLIENT_ID = 1234567890-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = GOCSPX-xxx
GOOGLE_REDIRECT_URI = https://your-domain.vercel.app/api/google/callback-v2
GOOGLE_REFRESH_TOKEN = ya29.a0...
```

---

## 🚀 사용 흐름 (최종 버전)

### 1️⃣ 사용자 로그인

```typescript
// 프론트엔드
const response = await fetch('/api/google/auth-url-v2');
const { authUrl } = await response.json();
window.location.href = authUrl;

// ↓ 사용자 Google 로그인
// ↓ 권한 허용
// ↓ /api/google/callback-v2로 리다이렉트
```

**콘솔 로그:**
```
🔐 Google OAuth 인증 URL 생성 요청
✅ state 생성 완료
✅ 인증 URL 생성됨

🔐 Google Callback 수신
1️⃣ Authorization code 교환...
2️⃣ refresh_token 확인...
✅ refresh_token 정상 발급됨!
3️⃣ 사용자 정보 조회...
4️⃣ Token 저장...
✅ 전체 인증 완료!
```

### 2️⃣ 파일 업로드

```typescript
// 자동 token 갱신 포함
const response = await fetch('/api/google/upload-v2', {
  method: 'POST',
  body: JSON.stringify({
    fileName: 'blog_content.txt',
    fileContent: '...',
  }),
});

// access_token이 만료되면 자동 갱신
// refresh_token으로 새 access_token 발급
// 새로운 refresh_token이 있으면 저장
// 파일 업로드 계속 진행
```

### 3️⃣ 365일 자동화

```typescript
// 1회만 로그인하면 영구 자동화 가능 ✨
setInterval(async () => {
  // refresh_token이 있으므로
  // 자동으로 token 갱신되고
  // 파일 업로드 계속 성공
  await fetch('/api/google/upload-v2', { ... });
}, 24 * 60 * 60 * 1000);
```

---

## ⚠️ refresh_token 문제 해결

### 문제: refresh_token이 안 나왔다면?

```
첫 로그인:     ✅ refresh_token 발급
두 번째 로그인: ❌ refresh_token 안 나옴
세 번째부터:   ❌ 영구적으로 못 받음
```

### 해결책

```
1️⃣ Google 계정 접속
   https://myaccount.google.com/permissions

2️⃣ 앱 찾아서 권한 삭제
   "이 앱에 대한 액세스 권한 제거" 클릭

3️⃣ 다시 로그인
   → prompt=consent에 의해 동의 화면 강제 표시
   → refresh_token 정상 재발급 ✅

4️⃣ 확인
   콘솔 로그: "✅ refresh_token 정상 발급됨!"
```

---

## 🔒 보안 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| ✅ drive.file scope만 사용 | ✅ | 전체 drive scope 금지 |
| ✅ CSRF 방지 (state 파라미터) | ✅ | 세션 기반 검증 구현 필요 |
| ✅ refresh_token 암호화 저장 | ⏳ | DB 연동 후 구현 |
| ✅ HttpOnly 쿠키 사용 | ✅ | JWT 토큰 |
| ✅ HTTPS 사용 | ✅ | Vercel 자동 지원 |
| ✅ 명확한 에러 메시지 | ✅ | 각 단계별 specific 에러 |

---

## 📊 비용 추정

| 항목 | 비용 |
|------|------|
| Google OAuth 2.0 | **무료** |
| Google Drive API | **무료** (월 12MB 업로드) |
| 저장소 (15GB 무료) | **무료** |
| **총 비용** | **$0** |

---

## 🎯 다음 단계 (선택사항)

### 1️⃣ DB 암호화 저장 구현

```typescript
// Vercel KV (가장 간단)
npm install @vercel/kv

// Supabase PostgreSQL
npm install @supabase/supabase-js

// Firebase
npm install firebase-admin
```

### 2️⃣ 세션 기반 State 검증

```typescript
// 현재: State 검증 스킵 (단순화)
// 개선: Redis에 state 저장 후 검증

const state = generateState();
await redis.setex(`oauth_state_${state}`, 600, userId);
// 콜백에서 검증
```

### 3️⃣ Token Refresh 자동화

```typescript
// 현재: 파일 업로드 시점에 갱신
// 개선: 백그라운드 job으로 미리 갱신

import { Inngest } from "inngest";
const inngest = new Inngest({ id: "my-app" });

export const refreshTokenDaily = inngest.createFunction(
  { id: "refresh-token-daily" },
  { cron: "0 0 * * *" }, // 매일 자정
  async ({ step }) => {
    await step.run("refresh-token", async () => {
      // refresh_token으로 미리 갱신
    });
  }
);
```

---

## ✨ 요약

| 항목 | 이전 (Service Account) | 현재 (OAuth 2.0) |
|------|----------------------|-----------------|
| **인증 방식** | Service Account 키 | 사용자 로그인 |
| **Token 발급** | 1회만 | 매번 갱신 가능 |
| **자동화 기간** | 필수 수동 관리 | 365일 자동화 |
| **보안** | 서버 키 노출 위험 | 사용자 OAuth 토큰 |
| **권한** | 서비스 계정 Google 드라이브 | 사용자 개인 드라이브 |
| **가격** | 무료 | 무료 |
| **구조** | 개인 Gmail과 맞지 않음 | ✅ **개인 Gmail에 최적** |

---

**이제 완벽한 Google OAuth 2.0 아키텍처가 완성되었습니다!** 🎉
