/**
 * 단일 사용자 Google OAuth Token 저장소
 *
 * 📌 설계:
 * - 단일 사용자만 사용 (본인)
 * - refresh_token 영구 저장 (환경변수 또는 외부 저장소)
 * - access_token은 메모리 캐시
 * - 자동 갱신 시 새로운 refresh_token 저장
 *
 * 🚀 Vercel 대응:
 * - 로컬: 메모리 사용
 * - Vercel: 환경변수 또는 Upstash Redis 사용
 */

import type { GoogleOAuthToken } from "@/types/index";

interface StoredToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  scope: string;
}

class SingleUserTokenStorage {
  // 메모리에 임시 저장 (현재 실행 중인 access_token)
  private currentToken: StoredToken | null = null;

  /**
   * refresh_token을 환경 변수에서 로드
   *
   * 📌 주의: refresh_token은 환경 변수로 관리됩니다
   * - 로컬: .env.local에 GOOGLE_REFRESH_TOKEN 설정
   * - Vercel: Settings → Environment Variables에 설정
   */
  private getStoredRefreshToken(): string | null {
    const storedToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (storedToken) {
      console.log("✅ 환경변수에서 refresh_token 로드됨");
      return storedToken;
    }

    console.warn("⚠️ 저장된 refresh_token이 없습니다");
    console.warn("   .env.local에 GOOGLE_REFRESH_TOKEN을 설정하세요");
    return null;
  }

  /**
   * 첫 로그인 후 token 저장
   *
   * 📌 critical: refresh_token을 영구 저장해야 합니다!
   */
  saveInitialToken(token: GoogleOAuthToken): void {
    console.log("💾 초기 token 저장");

    if (!token.refresh_token) {
      throw new Error(
        "❌ refresh_token이 없습니다!\n" +
        "원인: access_type=offline 또는 prompt=consent 옵션 누락\n" +
        "해결: 다시 로그인하고 동의 화면에서 권한을 허용하세요"
      );
    }

    // 메모리에 현재 token 저장
    this.currentToken = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type || "Bearer",
      expiry_date: token.expiry_date,
      scope: token.scope || "",
    };

    console.log("✅ 초기 token 저장 완료");
    console.log("🔑 refresh_token이 저장되었습니다");
    console.log("📌 이제 자동화 가능합니다");

    // ⚠️ 중요: 프로덕션에서는 다음 중 하나 필요
    // 1. Vercel Environment Variables에 저장
    // 2. Upstash Redis에 저장
    // 3. Supabase/Firebase에 저장
    console.log("\n⚠️ 환경 변수 설정 필요:");
    console.log(
      `export GOOGLE_REFRESH_TOKEN="${token.refresh_token.substring(0, 20)}..."`
    );
  }

  /**
   * 저장된 token 조회 (refresh_token 포함)
   */
  getToken(): StoredToken | null {
    // 1️⃣ 메모리에 있으면 사용
    if (this.currentToken) {
      console.log("✅ 메모리에서 token 로드됨");
      return this.currentToken;
    }

    // 2️⃣ 메모리에 없으면 refresh_token만 로드해서 임시 token 생성
    const refreshToken = this.getStoredRefreshToken();
    if (refreshToken) {
      // refresh_token으로 새 access_token을 발급받는 상황
      // 이 경우 access_token은 없지만 refresh_token은 있음
      console.log("📌 refresh_token만 로드됨 (access_token은 갱신 필요)");
      return {
        access_token: "", // 임시 (갱신 필요)
        refresh_token: refreshToken,
        token_type: "Bearer",
        expiry_date: 0, // 만료됨
        scope: "https://www.googleapis.com/auth/drive.file",
      };
    }

    console.error("❌ 저장된 token이 없습니다");
    return null;
  }

  /**
   * access_token 업데이트 (갱신 후)
   *
   * ⭐ 중요: 자동 갱신 시 새로운 refresh_token도 저장해야 함!
   */
  updateAccessToken(
    accessToken: string,
    expiryDate: number,
    newRefreshToken?: string
  ): void {
    if (!this.currentToken) {
      console.warn("⚠️ 현재 token이 없어서 업데이트할 수 없습니다");
      return;
    }

    console.log("🔄 access_token 업데이트");

    // access_token 업데이트
    this.currentToken.access_token = accessToken;
    this.currentToken.expiry_date = expiryDate;

    // ⭐ 새로운 refresh_token이 있으면 저장
    if (newRefreshToken) {
      console.log("🔄 새로운 refresh_token도 업데이트됨");
      this.currentToken.refresh_token = newRefreshToken;

      // 🚀 프로덕션: 여기서 환경변수 또는 DB 업데이트 필요
      console.log("📌 환경변수도 업데이트해야 합니다:");
      console.log(
        `export GOOGLE_REFRESH_TOKEN="${newRefreshToken.substring(0, 20)}..."`
      );
    }

    console.log("✅ token 업데이트 완료");
  }

  /**
   * refresh_token 조회 (갱신 시 사용)
   */
  getRefreshToken(): string | null {
    if (this.currentToken?.refresh_token) {
      return this.currentToken.refresh_token;
    }

    return this.getStoredRefreshToken();
  }

  /**
   * 사용자 로그아웃
   */
  logout(): void {
    console.log("👋 사용자 로그아웃");
    this.currentToken = null;
    console.log("✅ token 삭제 완료");
    console.log("⚠️ 다시 로그인해야 합니다");
  }

  /**
   * token 정보 조회 (디버깅용)
   */
  getInfo() {
    if (!this.currentToken) {
      return {
        status: "no_token",
        message: "저장된 token이 없습니다",
      };
    }

    return {
      status: "has_token",
      hasAccessToken: !!this.currentToken.access_token,
      hasRefreshToken: !!this.currentToken.refresh_token,
      expiryDate: new Date(this.currentToken.expiry_date),
      message: "token이 저장되어 있습니다",
    };
  }
}

// 싱글톤 인스턴스
const tokenStorage = new SingleUserTokenStorage();

export default tokenStorage;

/**
 * 🚀 Vercel 배포 시 필수:
 *
 * 1️⃣ 환경변수 설정
 *    Settings → Environment Variables
 *    GOOGLE_REFRESH_TOKEN = "ya29.a0..."
 *
 * 2️⃣ 새로운 refresh_token 받으면
 *    자동으로 환경변수 업데이트 필요
 *    (또는 Upstash Redis 사용)
 *
 * 3️⃣ 현재는 메모리 기반이므로
 *    Vercel에서는 자동 갱신 후
 *    새로운 refresh_token을 놓칠 수 있음
 *
 * ✅ 해결책:
 *    - Upstash Redis 연동
 *    - 또는 Supabase DB 연동
 *    - 또는 수동으로 환경변수 업데이트
 */
