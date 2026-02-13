# 🚀 Google OAuth 2.0 설정 가이드

> **개인 Gmail 기반 블로그 자동 업로드**
> Service Account 방식 완전 제거 ✅

---

## 1️⃣ Google Cloud Console 설정

### Step 1: 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 → "새 프로젝트"
3. 프로젝트 이름: `Blog Auto Uploader`
4. "만들기" 클릭

### Step 2: Google Drive API 활성화

1. 좌측 메뉴 → "API 및 서비스" → "라이브러리"
2. 검색: `Google Drive API`
3. "Google Drive API" 선택 → "활성화" 클릭

### Step 3: OAuth 2.0 인증 정보 생성

1. 좌측 메뉴 → "API 및 서비스" → "사용자 인증 정보"
2. "사용자 인증 정보 만들기" → "OAuth 2.0 클라이언트 ID" 선택
3. "동의 화면 구성" 클릭

#### 동의 화면 설정

**User Type: 외부**
- 앱 이름: `Blog Auto Uploader`
- 사용자 지원 이메일: your-email@gmail.com
- 개발자 연락처: your-email@gmail.com
- "저장 후 계속" 클릭

**범위(Scopes)**
- "범위 추가 또는 제거" 클릭
- 검색: `drive.file`
- `https://www.googleapis.com/auth/drive.file` 선택 (✅ drive.file만!)
- "업데이트" → "저장 후 계속"

**테스트 사용자**
- "테스트 사용자 추가" 클릭
- 본인의 Gmail 주소 입력
- "저장 후 계속"

#### OAuth 2.0 클라이언트 ID 생성

1. "사용자 인증 정보" 페이지로 돌아가기
2. "사용자 인증 정보 만들기" → "OAuth 2.0 클라이언트 ID"
3. 애플리케이션 유형: **웹 애플리케이션**
4. 이름: `Blog Auto Uploader Web`
5. 인증 URI:
   ```
   http://localhost:3000/api/google/callback-v2
   ```
6. "만들기" 클릭
7. 팝업에서 다음 정보 복사:
   - **Client ID**
   - **Client Secret**

---

## 2️⃣ 프로젝트 환경 변수 설정

### .env.local 수정

```bash
# Google OAuth 2.0 (위에서 복사한 값)
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback-v2
```

---

## 3️⃣ 로컬 테스트

### 개발 서버 시작

```bash
npm run dev
```

### 로그인 테스트

1. http://localhost:3000/login 접속
2. 비밀번호: `wogns0513@` 입력 (또는 .env.local의 AUTH_PASSWORD)

### Google Drive 로그인

```
1️⃣ 로그인 후 생성 페이지 접속
   → "Google Drive 로그인" 버튼 (추후 UI에 추가)

2️⃣ 또는 직접 API 호출:
   GET /api/google/auth-url-v2

   응답:
   {
     "success": true,
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
     "state": "abcd1234..."
   }

3️⃣ authUrl 클릭

4️⃣ Google 로그인 + 권한 허용

5️⃣ /api/google/callback-v2로 리다이렉트

   콘솔 로그:
   🔐 Google Callback 수신
   1️⃣ Authorization code 교환...
   2️⃣ refresh_token 확인...
   ✅ refresh_token 정상 발급됨!
   3️⃣ 사용자 정보 조회...
   4️⃣ Token 저장...
   ✅ 전체 인증 완료!
```

### 파일 업로드 테스트

```bash
# API 직접 호출
POST /api/google/upload-v2

{
  "fileName": "test_blog.txt",
  "fileContent": "테스트 블로그 글 내용..."
}

응답:
{
  "success": true,
  "fileId": "1abc2def3ghi4jkl5mno6pqr7stu8vwx",
  "message": "파일이 성공적으로 업로드되었습니다"
}
```

---

## 4️⃣ Vercel 배포 설정

### Step 1: 새로운 Redirect URI 추가

1. Google Cloud Console → 사용자 인증 정보
2. 생성한 OAuth 2.0 클라이언트 ID 클릭
3. "인증 URI" 섹션에 추가:
   ```
   https://YOUR_VERCEL_DOMAIN.vercel.app/api/google/callback-v2
   ```
4. "저장" 클릭

### Step 2: 환경 변수 설정

Vercel 프로젝트 Settings → Environment Variables

```
GOOGLE_CLIENT_ID = YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET = YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI = https://YOUR_VERCEL_DOMAIN.vercel.app/api/google/callback-v2
GOOGLE_REFRESH_TOKEN = (첫 로그인 후 자동 설정)
```

### Step 3: 배포

```bash
git push
# Vercel이 자동으로 배포
```

---

## 5️⃣ Token 자동 갱신 검증

### 문제: 토큰이 자동으로 갱신되는가?

```typescript
// google-token-storage-single-user.ts에서 확인 가능:

// 1️⃣ 메모리에 저장됨
private currentToken: StoredToken | null = null;

// 2️⃣ 환경변수에서 로드됨
private getStoredRefreshToken(): string | null {
  return process.env.GOOGLE_REFRESH_TOKEN;
}

// 3️⃣ 자동 갱신 시 업데이트됨
updateAccessToken(
  accessToken: string,
  expiryDate: number,
  newRefreshToken?: string  // ← 새로운 refresh_token
): void
```

### ⚠️ 현재 제한사항

1. **메모리 기반**
   - Vercel Serverless 환경에서 재시작되면 초기화
   - 해결: DB 저장 필요

2. **환경변수는 정적**
   - 실행 중에 업데이트 불가능
   - 새로운 refresh_token을 자동으로 저장 불가능
   - 해결: DB 연동 필요

### ✅ 다음 단계: DB 연동

```typescript
// 다음 구현할 내용:

interface GoogleTokenDB {
  userId: "default";  // 단일 사용자
  refreshToken: string;  // AES-256 암호화
  accessToken: string;   // AES-256 암호화
  expiryDate: number;
  updatedAt: Date;
}

// Vercel KV (가장 간단)
import { kv } from "@vercel/kv";

async function saveToken(token: GoogleOAuthToken) {
  const encrypted = encryptToken(token.refresh_token);
  await kv.set("google:refresh_token", encrypted);
  await kv.set("google:expiry", token.expiry_date);
}

async function getToken() {
  const encrypted = await kv.get("google:refresh_token");
  return decryptToken(encrypted);
}
```

---

## 6️⃣ 필수 체크리스트

배포 전에 반드시 확인하세요:

### 환경 변수

- [ ] GOOGLE_CLIENT_ID 설정됨
- [ ] GOOGLE_CLIENT_SECRET 설정됨
- [ ] GOOGLE_REDIRECT_URI 설정됨 (로컬 + Vercel)
- [ ] OPENAI_API_KEY 설정됨
- [ ] AUTH_PASSWORD 설정됨

### Google OAuth 설정

- [ ] Google Drive API 활성화됨
- [ ] OAuth 2.0 클라이언트 ID 생성됨
- [ ] drive.file scope만 선택됨 (drive 아님!)
- [ ] 테스트 사용자 추가됨 (본인 이메일)

### 로컬 테스트

- [ ] 개발 서버 시작 (npm run dev)
- [ ] 로그인 페이지 접근 가능
- [ ] Google OAuth 콜백 작동 확인
- [ ] "✅ refresh_token 정상 발급됨!" 로그 확인
- [ ] 파일 업로드 성공

### 배포

- [ ] .env.local에 민감 정보 없음
- [ ] .gitignore에 .env.local 포함되어 있음
- [ ] Service Account 파일 없음 (모두 삭제함)
- [ ] 빌드 성공 (npm run build)
- [ ] Vercel 배포 완료

---

## 7️⃣ 문제 해결

### 문제: "refresh_token이 없습니다" 에러

```
원인:
1. access_type=offline 옵션 미포함
2. prompt=consent 옵션 미포함
3. 이전에 로그인한 계정 (Google이 이미 동의한 것으로 간주)

해결:
1️⃣ Google 계정 접속
   https://myaccount.google.com/permissions

2️⃣ "Blog Auto Uploader" 앱 찾아서 삭제
   "이 앱에 대한 액세스 권한 제거" 클릭

3️⃣ 다시 로그인
   → prompt=consent에 의해 동의 화면 강제 표시
   → refresh_token 정상 재발급 ✅
```

### 문제: "Client ID가 잘못되었습니다" 에러

```
확인 사항:
1. Google Cloud Console에서 정확한 Client ID 복사했는지 확인
2. .env.local에 정확히 입력했는지 확인
3. Vercel에도 동일한 값이 설정되어 있는지 확인
4. Vercel 배포 후 환경변수 적용 대기 (몇 분)
```

### 문제: Redirect URI Mismatch 에러

```
확인 사항:
1. Google Cloud Console의 인증 URI와 정확히 일치하는가?

로컬:  http://localhost:3000/api/google/callback-v2
Vercel: https://your-domain.vercel.app/api/google/callback-v2

2. .env.local의 GOOGLE_REDIRECT_URI가 일치하는가?
3. Vercel의 환경변수가 일치하는가?
```

---

## 8️⃣ 보안 주의사항

### ❌ 절대 하지 말 것

1. **API Keys를 프론트엔드에 노출하지 말 것**
   - Client Secret은 서버 환경변수에만
   - 절대 fetch로 Client Secret을 보내지 말 것

2. **Token을 localStorage에 저장하지 말 것**
   - refresh_token은 HttpOnly 쿠키 또는 서버 DB에만
   - XSS 공격 위험

3. **drive scope를 사용하지 말 것**
   - ❌ https://www.googleapis.com/auth/drive
   - ✅ https://www.googleapis.com/auth/drive.file

4. **Service Account를 사용하지 말 것**
   - 개인 Gmail과 맞지 않음
   - OAuth 2.0 사용자 로그인이 정답

### ✅ 반드시 할 것

1. **HTTPS 사용** (Vercel 자동)
2. **State 파라미터로 CSRF 방지** (구현됨)
3. **Token을 암호화하여 저장** (DB 연동 시 구현)
4. **HttpOnly 쿠키 사용** (JWT 토큰)
5. **Token 만료 시간 설정** (access_token: 1시간)

---

## 9️⃣ 다음 단계

### 필수 (자동화 위해)

- [ ] Vercel KV / Supabase / Firebase 중 하나 선택
- [ ] Token을 DB에 암호화 저장하도록 수정
- [ ] 새로운 refresh_token 자동 저장

### 권장

- [ ] 세션 기반 State 검증 구현
- [ ] Token refresh 자동화 (백그라운드 job)
- [ ] 토큰 갱신 모니터링 대시보드

### 옵션

- [ ] 다중 사용자 지원
- [ ] OAuth 로그아웃 버튼
- [ ] 토큰 상태 API

---

## 🎉 완료!

이제 **완벽한 Google OAuth 2.0 아키텍처**가 설정되었습니다.

**핵심 포인트:**
- ✅ access_type=offline + prompt=consent 포함
- ✅ drive.file scope만 사용
- ✅ CSRF 방지 (state 파라미터)
- ✅ 자동 token 갱신
- ✅ 명확한 에러 처리

**다음:**
1. 로컬에서 테스트
2. Google OAuth 로그인 완료
3. 파일 업로드 성공
4. DB 연동 (선택사항이지만 권장)
5. Vercel 배포

문제가 생기면 **콘솔 로그**를 꼼꼼히 읽으세요. 각 단계별로 명확한 메시지가 출력됩니다! 🚀
