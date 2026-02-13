# Google OAuth 2.0 및 Drive 파일 업로드 가이드

## 📋 목차
1. [환경 변수 설정](#환경-변수-설정)
2. [로그인 플로우](#로그인-플로우)
3. [파일 업로드](#파일-업로드)
4. [토큰 갱신](#토큰-갱신-자동)
5. [API 명세](#api-명세)
6. [테스트 예제](#테스트-예제)
7. [Vercel 배포](#vercel-배포)

---

## 환경 변수 설정

### 1️⃣ Google Cloud Console에서 설정

**Project 생성 및 OAuth 2.0 클라이언트 ID 생성**
```
1. Google Cloud Console 접속 (console.cloud.google.com)
2. 새 프로젝트 생성
3. API 활성화:
   - Google Drive API
   - Google+ API
4. OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)
5. 리디렉션 URI 추가: https://yourdomain.com/api/google/callback
```

### 2️⃣ .env.local에 환경 변수 추가

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

### 3️⃣ Vercel에 환경 변수 추가

**Settings → Environment Variables**에 다음 추가:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/google/callback
```

---

## 🔥 Critical: access_type="offline" + prompt="consent"

### 왜 필수인가?

```
🚨 없을 때의 문제
─────────────────────────────────────────
상황                     결과
─────────────────────────────────────────
access_type 없음        ❌ refresh_token 미발급
prompt 없음             ❌ 재로그인부터 refresh_token 미발급
둘 다 없음              ❌ 자동화 완전 불가능
─────────────────────────────────────────

📊 실제 문제
─────────────────────────────────────────
1️⃣ access_token 받음 (1시간 유효)
2️⃣ 1시간 후 만료
3️⃣ refresh_token 없음
4️⃣ 다시 로그인 필수
5️⃣ 블로그 자동 업로드 완전 실패
```

### ✅ 올바른 구현

```typescript
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",  // ⭐ refresh_token 받기 위해 필수
  prompt: "consent",       // ⭐ 매번 동의 화면 표시 (refresh_token 재발급)
  scope: ["https://www.googleapis.com/auth/drive.file"],
});
```

### 각 옵션의 역할

| 옵션 | 역할 | 없으면 |
|------|------|--------|
| **access_type="offline"** | "오프라인에서도 API 사용 허락" 신호 | refresh_token 미발급 |
| **prompt="consent"** | 매번 강제로 동의 화면 표시 | 두 번째부터 refresh_token 미발급 |

### 🔑 동작 흐름

```
access_type="offline" + prompt="consent" 있을 때
──────────────────────────────────────────────

1️⃣ 첫 로그인
   → authorization code 받음
   → access_token + refresh_token 받음 ✅

2️⃣ 1시간 후 token 만료
   → refresh_token 사용 (자동)
   → 새로운 access_token 발급 ✅

3️⃣ 계속 자동화 가능
   → 사용자 개입 없이 무한 반복
   → 블로그 자동 업로드 가능 ✅

────────────────────────────────────────────

access_type="offline" 없을 때
────────────────────────────────
1️⃣ 첫 로그인
   → authorization code 받음
   → access_token만 받음 ❌

2️⃣ 1시간 후
   → refresh_token 없음 ❌
   → 다시 로그인 필수 ❌

────────────────────────────────────────────

prompt="consent" 없을 때
────────────────────────────────
1️⃣ 첫 로그인
   → 동의 화면 표시
   → access_token + refresh_token 받음 ✅

2️⃣ 두 번째 로그인
   → 동의 화면 스킵
   → access_token만 받음 ❌
   → refresh_token 미발급 ❌
```

### 🆘 이미 로그인했는데 refresh_token이 없다면?

```
원인: prompt="consent" 없이 로그인 후
      Google이 이미 동의한 것으로 간주

해결 방법:
──────────────────────────────────────────
1️⃣ Google 계정 접속
   https://myaccount.google.com/permissions

2️⃣ 앱 삭제
   해당 애플리케이션 선택 → "제거" 클릭

3️⃣ 다시 로그인
   → prompt="consent"에 의해 동의 화면 표시
   → refresh_token 재발급 ✅
```

---

## 로그인 플로우

### 클라이언트 측 (프론트엔드)

```typescript
// 1️⃣ 로그인 URL 가져오기
const response = await fetch('/api/google/auth-url');
const { url } = await response.json();

// 2️⃣ Google 로그인 페이지로 리다이렉트
window.location.href = url;

// 또는 팝업에서 열기
window.open(url, 'google-login', 'width=500,height=600');
```

### 서버 측 (백엔드)

```
Google OAuth 2.0 플로우:
┌─────────────────────────────────────────────────────────┐
│ 1. GET /api/google/auth-url                             │
│    → Google 인증 URL 생성                               │
│    ← URL 반환                                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. 사용자가 Google 로그인 (브라우저에서)                   │
│    → Google 로그인 페이지                                │
│    ← Authorization code 받음                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. GET /api/google/callback?code=...                    │
│    → Authorization code 교환                            │
│    → Access token 받음                                  │
│    → 사용자 정보 조회                                    │
│    → 토큰 저장 (메모리/DB)                              │
│    ← 사용자 정보 반환                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 파일 업로드

### 기본 사용법

```typescript
// 파일을 Google Drive에 업로드
const response = await fetch('/api/google/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userEmail: 'user@example.com',
    fileName: 'blog_style.txt',
    fileContent: '파일 내용',
    mimeType: 'text/plain', // 선택사항
  }),
});

const { success, fileId, webViewLink } = await response.json();

if (success) {
  console.log('업로드 성공:', fileId);
  console.log('Google Drive 링크:', webViewLink);
}
```

### 지원하는 MIME 타입

| 파일 유형 | MIME 타입 |
|----------|----------|
| 텍스트 | `text/plain` |
| JSON | `application/json` |
| CSV | `text/csv` |
| PDF | `application/pdf` |
| Word | `application/msword` |
| Excel | `application/vnd.ms-excel` |

---

## 토큰 갱신 (자동)

### 토큰 만료 처리

**토큰 자동 갱신이 포함되어 있으므로 별도 처리 불필요합니다.**

```typescript
// google-drive-upload.ts의 getValidToken() 함수
// → 자동으로 토큰 만료 확인
// → refresh_token으로 새로운 access_token 발급
// → 토큰 저장소 업데이트
```

**만료 조건:**
- Access token 만료 시간 5분 전에 갱신
- Refresh token이 필수 (처음 로그인 시 받음)

---

## API 명세

### 1. 로그인 URL 생성

```
GET /api/google/auth-url

Response:
{
  "success": true,
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### 2. OAuth Callback 처리

```
GET /api/google/callback?code=...&state=...

Response:
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://..."
  },
  "message": "User Name님이 로그인했습니다"
}
```

### 3. Google Drive에 파일 업로드

```
POST /api/google/upload

Request:
{
  "userEmail": "user@example.com",
  "fileName": "blog_style.txt",
  "fileContent": "파일 내용",
  "mimeType": "text/plain"
}

Response:
{
  "success": true,
  "fileId": "file123...",
  "webViewLink": "https://drive.google.com/file/d/file123/view",
  "message": "파일이 Google Drive에 업로드되었습니다"
}
```

---

## 테스트 예제

### cURL로 테스트

```bash
# 1️⃣ 로그인 URL 생성
curl http://localhost:3000/api/google/auth-url

# 응답:
# {
#   "success": true,
#   "url": "https://accounts.google.com/..."
# }

# 2️⃣ 파일 업로드 (토큰이 있다고 가정)
curl -X POST http://localhost:3000/api/google/upload \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "user@example.com",
    "fileName": "test.txt",
    "fileContent": "Hello, Google Drive!",
    "mimeType": "text/plain"
  }'
```

### 프로덕션 예제

```typescript
// app/(protected)/google-drive/page.tsx
'use client';

import { useState } from 'react';

export default function GoogleDrivePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/google/auth-url');
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('로그인 URL 생성 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/google/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: 'user@example.com',
          fileName: 'blog_content.txt',
          fileContent: '블로그 글 내용...',
          mimeType: 'text/plain',
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('업로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <button
        onClick={handleLogin}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? '로딩 중...' : 'Google 로그인'}
      </button>

      <button
        onClick={handleUpload}
        disabled={loading}
        className="px-4 py-2 bg-green-500 text-white rounded"
      >
        {loading ? '업로드 중...' : 'Google Drive에 업로드'}
      </button>

      {result && (
        <div className="p-4 bg-green-50 rounded">
          <p>✅ 업로드 성공!</p>
          <p>파일 ID: {result.fileId}</p>
          <a
            href={result.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            Google Drive에서 보기
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## Vercel 배포

### 1️⃣ 환경 변수 설정

**Vercel 대시보드 → Settings → Environment Variables**

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/google/callback
```

### 2️⃣ Google Cloud Console에서 리디렉션 URI 수정

```
https://your-domain.vercel.app/api/google/callback
```

### 3️⃣ 배포

```bash
git add .
git commit -m "feat: Add Google OAuth 2.0 and Drive integration"
git push origin main
```

---

## ⚠️ 주의사항

### 토큰 저장소 (메모리 기반)

**현재 구현 (메모리 기반):**
- ✅ 로컬 개발: 완벽히 작동
- ⚠️ Vercel: 제한적 (serverless 환경에서 인스턴스 간 메모리 공유 안 됨)

**프로덕션 권장:**
1. **Vercel KV (Redis)** - 가장 간단
   ```typescript
   import { kv } from '@vercel/kv';
   await kv.set(`google_token:${userEmail}`, JSON.stringify(token));
   ```

2. **PostgreSQL** - 가장 안정적
   ```sql
   CREATE TABLE google_tokens (
     email VARCHAR(255) PRIMARY KEY,
     access_token TEXT,
     refresh_token TEXT,
     expiry_date BIGINT,
     created_at TIMESTAMP
   );
   ```

3. **MongoDB** - 유연함
   ```typescript
   await tokensCollection.updateOne(
     { email: userEmail },
     { $set: token },
     { upsert: true }
   );
   ```

### 보안

- ✅ 환경 변수로 자격증명 관리
- ✅ Refresh token 저장 (offline access)
- ✅ 토큰 만료 처리 자동화
- ❌ 토큰을 클라이언트로 전송하지 않음
- ❌ API 응답에 민감한 정보 노출 금지

---

## 파일 구조

```
lib/utils/
├── google-oauth-client.ts       # OAuth 2.0 클라이언트
├── google-token-storage.ts      # 토큰 저장소 (메모리)
└── google-drive-upload.ts       # Drive 파일 업로드

app/api/google/
├── auth-url/route.ts            # 인증 URL 생성
├── callback/route.ts            # OAuth Callback 처리
└── upload/route.ts              # 파일 업로드
```

---

## 🆘 트러블슈팅

### "GOOGLE_CLIENT_ID가 설정되지 않았습니다"

```
✅ 확인사항:
1. .env.local에 환경 변수 설정
2. Vercel에 환경 변수 설정
3. npm run dev 재시작
4. 브라우저 캐시 삭제
```

### "Refresh token이 없습니다"

```
✅ 원인: prompt: 'consent' 없이 재로그인 시 refresh_token 미발급

해결:
→ 사용자가 계정 연결 해제 후 다시 로그인
또는
→ https://myaccount.google.com/permissions로 접근 권한 삭제
```

### Vercel에서 토큰이 사라짐

```
✅ 원인: 메모리 기반 저장소 (serverless 특성)

해결:
→ Vercel KV 또는 데이터베이스로 마이그레이션 필요
```

---

## 📚 참고 자료

- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API 문서](https://developers.google.com/drive)
- [googleapis npm 문서](https://github.com/googleapis/google-api-nodejs-client)
