# 🔥 refresh_token 필수 옵션 - 완전 가이드

> ⭐ 이것을 모르면 블로그 자동 업로드는 불가능합니다.

---

## 📊 문제 상황

### ❌ refresh_token이 없을 때

```
timeline
─────────────────────────────────────────────
시간        상황              결과
─────────────────────────────────────────────
0분        사용자 로그인       ✅ access_token 받음
           블로그 업로드       ✅ 성공

60분       access_token 만료   ❌ 다시 로그인 필수
           블로그 업로드       ❌ 실패

120분      계속 실패           ❌ 자동화 불가능
```

### ✅ refresh_token이 있을 때

```
timeline
─────────────────────────────────────────────
시간        상황                   결과
─────────────────────────────────────────────
0분        사용자 로그인           ✅ access_token + refresh_token
           블로그 업로드           ✅ 성공

60분       access_token 만료       ✅ 자동으로 refresh
           새로운 access_token     ✅ 자동 발급
           블로그 업로드           ✅ 자동 성공

120분      계속 자동 갱신          ✅ 무한 반복 가능
365일      여전히 자동화 중        ✅ 완전 자동화 ⭐
```

---

## 🔑 핵심: 2가지 필수 옵션

### 1️⃣ access_type="offline"

**의미:**
```
"사용자가 온라인이 아닐 때도 API를 쓰고 싶다"
```

**역할:**
- Google에 refresh_token을 발급해달라는 신호
- 없으면 Google은 refresh_token을 안 줌

**코드:**
```typescript
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",  // 📌 필수!
  scope: scopes,
});
```

**없을 때:**
```
❌ refresh_token이 발급되지 않음
❌ 1시간 후 다시 로그인 필수
❌ 자동화 불가능
```

---

### 2️⃣ prompt="consent"

**의미:**
```
"매번 사용자에게 동의 화면을 보여줘"
```

**왜 필요한가?**
```
Google은 한 번 동의한 계정에는 자동으로 동의 상태로 간주합니다.

그래서 두 번째 로그인부터는:
- 동의 화면을 스킵 → refresh_token이 안 나옴
- prompt="consent" 없으면 영구적으로 refresh_token 못 받음
```

**코드:**
```typescript
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",        // 📌 필수! (두 번째 이상 로그인에서 critical)
  scope: scopes,
});
```

**없을 때:**
```
첫 로그인       → refresh_token이 나옴 (잠깐!)
두 번째 로그인  → refresh_token이 안 나옴
세 번째부터     → 영구적으로 refresh_token 못 받음
❌ 완전 자동화 불가능
```

---

## 📌 올바른 구현

```typescript
// ✅ 올바른 구현
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",  // ⭐ 필수
  prompt: "consent",       // ⭐ 필수
  scope: [
    "https://www.googleapis.com/auth/drive.file",
  ],
});
```

---

## 🔄 Token 갱신 자동 흐름

```
저장된 토큰 확인
  ↓
만료 여부 체크 (5분 버퍼)
  ↓
만료되지 않음              만료됨
    ↓                       ↓
  그대로 사용              refresh_token 사용
                              ↓
                         새로운 access_token 발급
                              ↓
                         토큰 저장소 업데이트
                              ↓
                         파일 업로드 계속 진행 ✅
```

**코드:**
```typescript
async function getValidToken(userEmail: string) {
  const token = tokenStorage.get(userEmail);

  // 1️⃣ 만료 여부 확인
  if (isTokenExpired(token.expiry_date)) {
    // 2️⃣ refresh_token으로 새 access_token 발급
    const newToken = await refreshAccessToken(token.refresh_token);

    // 3️⃣ 저장소 업데이트
    tokenStorage.update(userEmail, newToken.access_token, newToken.expiry_date);
  }

  return token;
}
```

---

## 🚨 실전 팁

### 만약 refresh_token이 안 나왔다면?

**원인:**
1. `access_type="offline"` 옵션 누락
2. `prompt="consent"` 옵션 누락
3. 이전 로그인 캐시 (Google이 이미 동의한 것으로 간주)

**해결 방법:**

```
1️⃣ Google 계정 접속
   https://myaccount.google.com/permissions

2️⃣ 앱 찾아서 삭제
   "이 앱에 대한 액세스 권한 제거" 클릭

3️⃣ 다시 로그인
   → prompt="consent"에 의해 동의 화면 강제 표시
   → refresh_token 정상 재발급 ✅

4️⃣ 확인
   콘솔 로그에서 이 메시지 확인:
   "✅ refresh_token이 정상 발급됨!"
```

---

## 📋 체크리스트

배포 전에 반드시 확인하세요:

```
로그인 URL 생성 시:
  ☐ access_type="offline" 포함
  ☐ prompt="consent" 포함

콘솔 로그 확인:
  ☐ "✅ refresh_token이 정상 발급됨!" 메시지 출력
  ☐ "✅ Google Drive 클라이언트 초기화 완료" 출력

파일 업로드 테스트:
  ☐ 첫 번째 업로드 성공
  ☐ 저장된 token 확인
  ☐ 토큰 갱신 로그 확인

장시간 테스트:
  ☐ 1시간 이후 자동 갱신 확인
  ☐ 파일 업로드 계속 작동 확인
```

---

## 🎯 최종 정리

| 항목 | 내용 | 필수 여부 |
|------|------|---------|
| **access_type="offline"** | refresh_token 요청 신호 | ⭐⭐⭐ |
| **prompt="consent"** | 강제 동의 화면 표시 | ⭐⭐⭐ |
| **Refresh 자동화** | 만료 시 자동으로 새 token | ⭐⭐⭐ |
| **Token 저장소** | access_token + refresh_token 저장 | ⭐⭐⭐ |

---

## 🚀 이제 가능한 것

```typescript
// ✅ 완전 자동화 가능한 패턴

// 1️⃣ 사용자가 한 번 로그인
window.location.href = '/api/google/auth-url';

// 2️⃣ 그 이후로는 무한 자동화
const uploadBlogAutomatically = setInterval(async () => {
  // refresh_token이 있으므로
  // 자동으로 token 갱신되고
  // 파일 업로드 계속 성공
  await fetch('/api/google/upload', {
    method: 'POST',
    body: JSON.stringify({
      userEmail: 'user@example.com',
      fileName: 'blog_content.txt',
      fileContent: newBlogContent,
    }),
  });
}, 24 * 60 * 60 * 1000); // 매일 자동 업로드 ⭐
```

---

## 📞 문제 발생 시

**콘솔에서 확인할 메시지들:**

```
✅ 성공 시나리오
─────────────────────────────────────────
🔍 Base64 환경 변수에서 서비스 계정 키 읽는 중...
✅ 인증 URL 생성됨
📌 옵션: access_type=offline, prompt=consent
✅ refresh_token이 정상 발급됨!
📌 이제 자동화 가능 (사용자 재로그인 불필요)
📝 블로그 스타일 파일 생성 완료

❌ 실패 시나리오
─────────────────────────────────────────
⚠️ refresh_token이 없습니다!
   원인: prompt=consent 옵션 누락 또는 이전 로그인 캐시
   해결: Google 계정 → 보안 → 타사 앱 액세스에서 앱 삭제 후 재로그인
```

---

**이 내용을 이해하면 Google OAuth 자동화의 모든 것을 알게 됩니다.** ⭐
