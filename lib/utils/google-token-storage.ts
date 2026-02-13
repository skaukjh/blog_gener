import type { GoogleOAuthToken } from "@/types/index";

/**
 * 메모리 기반 토큰 저장소 (Vercel 환경용)
 * 프로덕션에서는 데이터베이스(PostgreSQL, MongoDB 등)로 대체 필요
 *
 * 📌 refresh_token 저장의 중요성
 * ───────────────────────────────────────────────────────
 * refresh_token이 없으면:
 *   - access_token 만료 시 재로그인 필수
 *   - 블로그 자동 업로드 불가능
 *
 * refresh_token이 있으면:
 *   - access_token 만료 → 자동으로 새 token 발급
 *   - 사용자 개입 없이 무한 반복
 *   - 완전 자동화 가능 ✅
 *
 * 🔑 처음 로그인 시 반드시 확인:
 *   access_type="offline" + prompt="consent" 필수!
 */
class GoogleTokenStorage {
  private tokens: Map<string, GoogleOAuthToken> = new Map();

  /**
   * 토큰 저장
   * @param userId - 사용자 ID (이메일 사용)
   * @param token - Google OAuth Token (refresh_token 포함 여부 확인!)
   */
  save(userId: string, token: GoogleOAuthToken): void {
    console.log(`💾 토큰 저장: ${userId}`);
    if (token.refresh_token) {
      console.log("✅ refresh_token이 있습니다 → 자동화 가능!");
    } else {
      console.warn("⚠️ refresh_token이 없습니다 → 자동화 불가!");
      console.warn("   다시 로그인하고 prompt=consent 옵션 확인!");
    }
    this.tokens.set(userId, token);
  }

  /**
   * 토큰 조회
   * @param userId - 사용자 ID (이메일 사용)
   */
  get(userId: string): GoogleOAuthToken | undefined {
    const token = this.tokens.get(userId);
    if (token) {
      console.log(`✅ 토큰 조회 성공: ${userId}`);
    } else {
      console.log(`⚠️ 저장된 토큰 없음: ${userId}`);
    }
    return token;
  }

  /**
   * 토큰 업데이트 (주로 access_token 갱신 시 사용)
   * @param userId - 사용자 ID
   * @param accessToken - 새로운 access_token
   * @param expiryDate - 새로운 expiry_date
   */
  update(userId: string, accessToken: string, expiryDate: number): void {
    const existingToken = this.tokens.get(userId);
    if (existingToken) {
      existingToken.access_token = accessToken;
      existingToken.expiry_date = expiryDate;
      console.log(`🔄 토큰 갱신 완료: ${userId}`);
    } else {
      console.warn(`⚠️ 업데이트할 토큰이 없습니다: ${userId}`);
    }
  }

  /**
   * 토큰 삭제 (로그아웃)
   * @param userId - 사용자 ID
   */
  delete(userId: string): void {
    this.tokens.delete(userId);
    console.log(`🗑️ 토큰 삭제: ${userId}`);
  }

  /**
   * 모든 토큰 조회 (디버깅용)
   */
  getAll(): Record<string, GoogleOAuthToken> {
    const result: Record<string, GoogleOAuthToken> = {};
    this.tokens.forEach((token, userId) => {
      result[userId] = token;
    });
    return result;
  }

  /**
   * 저장된 토큰 개수
   */
  size(): number {
    return this.tokens.size;
  }

  /**
   * 저장소 초기화 (테스트용)
   */
  clear(): void {
    this.tokens.clear();
    console.log("🗑️ 토큰 저장소 초기화");
  }
}

// 싱글톤 인스턴스
const tokenStorage = new GoogleTokenStorage();

export default tokenStorage;

/**
 * ⚠️ 주의: Vercel 배포 시 주의사항
 *
 * 현재 메모리 기반 저장소는:
 * ✅ 로컬 개발 환경에서는 잘 작동
 * ⚠️ Vercel의 serverless 환경에서는 제한적
 *    → 서로 다른 실행 인스턴스 간에 메모리 공유 안 됨
 *    → 요청마다 새로운 프로세스 생성
 *
 * 📊 프로덕션에서는 다음을 사용하세요:
 * 1. Vercel KV (Redis) - 가장 간단
 * 2. PostgreSQL - 가장 안정적
 * 3. MongoDB - 유연함
 * 4. DynamoDB - AWS 사용자용
 *
 * 구현 예시 (Vercel KV):
 * await kv.set(`google_token:${userId}`, JSON.stringify(token));
 * const token = await kv.get(`google_token:${userId}`);
 */
