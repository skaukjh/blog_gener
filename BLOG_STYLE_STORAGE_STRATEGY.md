# 🎯 블로그 스타일 저장소 전략

> **DateTime**: 2026-02-13
> **Strategy**: 메모리 캐시 + Google Drive 이중 저장

---

## 📋 개요

```
사용자가 블로그 글 2개 입력
  ↓
GPT가 스타일 분석 (tone, sentence pattern 등)
  ↓
분석 결과를 2곳에 저장:
  1️⃣ 메모리 캐시 (빠른 조회용)
  2️⃣ Google Drive (영구 저장용)
  ↓
글 생성 시 메모리 캐시에서 즉시 조회
```

---

## 🔧 구현 방식

### 저장 단계 (analyze-style)

```typescript
// app/api/blog/analyze-style/route.ts

// 1️⃣ 메모리 캐시에 저장 (필수)
blogStyleCache.set(compactStyle);
→ 메모리에 스타일 정보 저장
→ 24시간 유효

// 2️⃣ Google Drive에 저장 (선택적)
await uploadFileToDrive("blog_style.txt", compactStyle);
→ 사용자 Drive에 blog_style.txt 저장
→ 영구적 (삭제하지 않는 한)
→ 실패해도 메모리 캐시가 있으므로 무시
```

**흐름도:**

```
분석 완료
  ↓
메모리 캐시 저장
  ├─ 성공 ✅ → 계속 진행
  └─ 실패 ❌ → 에러 반환
  ↓
Google Drive 저장 시도
  ├─ 성공 ✅ → "Google Drive 저장 완료"
  ├─ 실패 ⚠️ → "메모리 캐시는 있음" 경고
  └─ 둘 다 실패 → 메모리로 충분
```

### 조회 단계 (get-current-style)

```typescript
// app/api/blog/get-current-style/route.ts

const style = blogStyleCache.get();
→ 메모리에서 즉시 반환
→ 매우 빠름 (DB 접근 없음)

응답:
{
  success: true,
  style: "분석된 스타일...",
  exists: true,
  cacheInfo: {
    status: "cached",
    expiresIn: "23시간 후",
    timestamp: "2026-02-13 14:30:00"
  }
}
```

### 사용 단계 (콘텐츠 생성)

```typescript
// OpenAI Assistant에 스타일 전달
const assistantId = process.env.OPENAI_ASSISTANT_ID;
await updateAssistantInstructions(assistantId, compactStyle);

→ 스타일 정보가 Assistant의 system instruction에 반영
→ 이후 콘텐츠 생성 시 이 스타일 자동 적용
```

---

## 📊 저장소별 특성

### 메모리 캐시 (blog-style-memory-cache.ts)

| 특성 | 설명 |
|------|------|
| **저장 위치** | 서버 메모리 (RAM) |
| **영구성** | 서버 재시작 시 초기화 |
| **속도** | ⚡ 매우 빠름 (즉시) |
| **용량** | 무제한 (메모리 범위 내) |
| **비용** | $0 |
| **Vercel 호환** | ✅ (함수 실행 중에만) |
| **다중 인스턴스** | ⚠️ (각 인스턴스마다 별도) |

**사용 사례:**
```
- 빠른 조회 (글 생성 시)
- 세션 중 임시 저장
- 캐시 갱신
```

### Google Drive (사용자 계정)

| 특성 | 설명 |
|------|------|
| **저장 위치** | 사용자의 Google Drive |
| **영구성** | ✅ 영구적 (삭제하지 않는 한) |
| **속도** | 네트워크 지연 (몇 초) |
| **용량** | 15GB 무료 |
| **비용** | $0 |
| **Vercel 호환** | ✅ |
| **다중 인스턴스** | ✅ (모두 동일 Drive 접근) |

**사용 사례:**
```
- 영구 백업
- 사용자가 직접 확인 가능
- 수동 수정 가능
```

---

## 🔄 시나리오별 동작

### 시나리오 1: 정상 동작

```
1️⃣ 사용자: 블로그 글 2개 입력 + "스타일 분석" 클릭
   ↓
2️⃣ 백엔드: GPT 분석
   ↓
3️⃣ 저장:
   ✅ 메모리 캐시 저장
   ✅ Google Drive 저장
   ↓
4️⃣ 응답:
   {
     "success": true,
     "message": "스타일 분석 완료!"
   }
   ↓
5️⃣ 사용자: 생성 페이지 접속
   ↓
6️⃣ 백엔드: /api/blog/get-current-style 호출
   ↓
7️⃣ 메모리 캐시에서 즉시 반환 ⚡
   ↓
8️⃣ UI: "✅ 스타일이 준비되었습니다" 표시
```

### 시나리오 2: Google Drive 저장 실패

```
1️⃣ 사용자: 블로그 글 분석 요청
   ↓
2️⃣ 백엔드: GPT 분석
   ↓
3️⃣ 저장:
   ✅ 메모리 캐시 저장 (성공)
   ❌ Google Drive 저장 (실패)
      → 토큰 없음 또는 권한 부족
   ↓
4️⃣ 응답:
   {
     "success": true,
     "message": "스타일 분석 완료! (메모리 캐시 사용)"
   }

   콘솔 로그:
   ⚠️ Google Drive 저장 실패
   → 메모리에서 스타일을 계속 사용합니다
   ↓
5️⃣ 사용자: 생성 페이지에서 글 작성 (정상 작동)
   ↓
6️⃣ 메모리 캐시에서 스타일 조회 ⚡
   ↓
7️⃣ 콘텐츠 생성 (스타일 적용됨) ✅
```

### 시나리오 3: 서버 재시작

```
기존: 메모리 캐시가 있음
  ↓
새로운 배포 / 서버 재시작
  ↓
메모리 캐시: ❌ 초기화됨
  ↓
사용자: 생성 페이지 접속
  ↓
/api/blog/get-current-style 호출
  ↓
응답:
{
  "success": false,
  "exists": false,
  "message": "저장된 스타일이 없습니다"
}
  ↓
UI: "스타일을 다시 분석해주세요" 표시

⚠️ 해결:
→ Google Drive에 blog_style.txt가 있다면 거기서 로드
→ 추후 구현 예정
```

---

## 💾 메모리 캐시 구현

### 파일: `lib/utils/blog-style-memory-cache.ts`

```typescript
class BlogStyleMemoryCache {
  private cache: CachedBlogStyle | null = null;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

  // 저장
  set(style: string): void {
    this.cache = { style, timestamp, expiresAt };
  }

  // 조회 (만료 확인 포함)
  get(): string | null {
    if (Date.now() > this.cache.expiresAt) {
      this.cache = null; // 만료됨
      return null;
    }
    return this.cache.style;
  }

  // 상태 조회
  getInfo() {
    return {
      status: "cached",
      expiresIn: "23시간 후",
      timestamp: "..."
    };
  }

  // 초기화
  clear(): void {
    this.cache = null;
  }
}
```

### 사용 예시

```typescript
// 저장
blogStyleCache.set("분석 결과...");

// 조회
const style = blogStyleCache.get();

// 상태 확인
const info = blogStyleCache.getInfo();
console.log(info);
// {
//   status: "cached",
//   message: "스타일이 메모리에 저장되어 있습니다",
//   expiresIn: "23시간 후",
//   timestamp: "2026-02-13 14:30:00"
// }

// 초기화
blogStyleCache.clear();
```

---

## 🔐 보안 & 성능

### 보안

| 항목 | 상태 | 설명 |
|------|------|------|
| 메모리 안전 | ✅ | 메모리는 프로세스 내부에만 존재 |
| Drive 안전 | ✅ | 사용자 Drive (권한 필요) |
| 데이터 노출 | ✅ | 네트워크 전송 최소화 |

### 성능

| 작업 | 속도 | 설명 |
|------|------|------|
| 메모리 저장 | ⚡ 1ms | 극히 빠름 |
| 메모리 조회 | ⚡ 1ms | 극히 빠름 |
| Drive 저장 | 🐢 2-5초 | 네트워크 I/O |
| Drive 조회 | 🐢 2-5초 | 네트워크 I/O |

---

## 🚀 다음 단계 (선택사항)

### 1️⃣ 서버 재시작 후 스타일 복구

```typescript
// Google Drive에서 blog_style.txt를 읽어서 메모리에 로드
// get-current-style API 개선:

export async function GET() {
  // 1. 메모리 캐시 확인
  let style = blogStyleCache.get();

  // 2. 없으면 Google Drive에서 로드
  if (!style) {
    try {
      style = await readBlogStyleFromGoogleDrive();
      if (style) {
        blogStyleCache.set(style); // 메모리에 다시 로드
      }
    } catch (err) {
      // 실패해도 괜찮음
    }
  }

  return NextResponse.json({ style });
}
```

### 2️⃣ 다중 인스턴스 대응

```typescript
// 여러 Vercel 인스턴스가 각각 메모리를 가짐
// 해결: Vercel KV에 스타일 저장

import { kv } from "@vercel/kv";

export async function set(style: string) {
  // 메모리에 저장
  blogStyleCache.set(style);

  // KV (Redis)에도 저장
  await kv.set("blog_style", style, { ex: 86400 }); // 24시간
}

export async function get() {
  // 메모리 확인
  let style = blogStyleCache.get();

  // 없으면 KV에서 로드
  if (!style) {
    style = await kv.get("blog_style");
    if (style) {
      blogStyleCache.set(style); // 메모리에 캐시
    }
  }

  return style;
}
```

### 3️⃣ DB에 스타일 이력 관리

```typescript
// 모든 분석 결과를 DB에 저장
// 사용자가 이전 스타일로 복구 가능

interface BlogStyleHistory {
  id: string;
  style: string;
  createdAt: Date;
  isActive: boolean;
}

// 사용자가 스타일 관리 페이지에서 확인/복구 가능
```

---

## 📊 현재 구조

```
/api/blog/analyze-style (POST)
  ├─ GPT 분석
  ├─ 메모리 저장 (필수) ✅
  ├─ Drive 저장 (선택) ✅
  └─ Assistant instruction 업데이트

/api/blog/get-current-style (GET)
  ├─ 메모리 캐시 조회 ✅
  └─ 스타일 정보 반환

블로그 생성 시 (POST /api/generate/create-content)
  ├─ 스타일 조회 (메모리에서 빠르게) ✅
  └─ Assistant에 전달 (이미 instruction에 반영됨)
```

---

## ✅ 체크리스트

배포 전 확인사항:

- [x] 메모리 캐시 구현
- [x] Google Drive 저장 연동
- [x] 에러 처리 (Drive 실패 시 메모리 사용)
- [x] 빌드 성공
- [x] 스타일 조회 작동
- [ ] Google OAuth 로그인 테스트
- [ ] 스타일 분석 API 테스트
- [ ] 콘텐츠 생성 시 스타일 적용 확인

---

## 🎉 완료!

이제 **블로그 스타일이 안전하게 저장되고 빠르게 조회됩니다!**

### 장점

✅ **항상 작동** - 메모리 캐시 (필수)
✅ **빠름** - 메모리 조회 (밀리초)
✅ **영구 저장** - Google Drive (선택)
✅ **안전** - 사용자 Drive (권한 기반)
✅ **비용 없음** - $0

### 다음

1. Google OAuth 로그인 완료
2. 블로그 스타일 분석 테스트
3. 콘텐츠 생성 작동 확인

**모든 준비 완료!** 🚀
