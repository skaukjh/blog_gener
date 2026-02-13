// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getUserInfo,
} from "@/lib/utils/google-oauth-client";
import tokenStorage from "@/lib/utils/google-token-storage";
import type { GoogleCallbackResponse, GoogleOAuthToken } from "@/types/index";

/**
 * GET /api/google/callback
 * Google OAuth 2.0 Callback 처리
 *
 * Query Parameters:
 * - code: Authorization code (Google에서 전달)
 * - state: CSRF 토큰 (선택사항)
 * - error: 에러 메시지 (거부 시)
 *
 * 응답:
 * {
 *   "success": true,
 *   "user": {
 *     "id": "...",
 *     "email": "user@example.com",
 *     "name": "User Name",
 *     "picture": "https://..."
 *   }
 * }
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GoogleCallbackResponse>> {
  try {
    // Query parameter 추출
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    console.log("🔐 Google Callback 수신");

    // 사용자가 거부한 경우
    if (error) {
      console.warn("⚠️ 사용자가 인증을 거부했습니다:", error);
      return NextResponse.json(
        {
          success: false,
          error: `인증 거부됨: ${error}`,
        },
        { status: 400 }
      );
    }

    // Authorization code 확인
    if (!code) {
      console.error("❌ Authorization code가 없습니다");
      return NextResponse.json(
        {
          success: false,
          error: "Authorization code가 누락되었습니다",
        },
        { status: 400 }
      );
    }

    // 1️⃣ Authorization code를 access token으로 교환
    console.log("1️⃣ Authorization code 교환 중...");
    console.log("💡 refresh_token이 나오는지 확인:");
    console.log("   - access_type=offline ✅");
    console.log("   - prompt=consent ✅");
    const tokenData = await exchangeCodeForToken(code);

    if (tokenData.refresh_token) {
      console.log("✅ refresh_token이 정상 발급됨!");
      console.log("📌 이제 자동화 가능 (사용자 재로그인 불필요)");
    } else {
      console.warn("⚠️ refresh_token이 없습니다!");
      console.warn("   원인: prompt=consent 옵션 누락 또는 이전 로그인 캐시");
      console.warn("   해결: Google 계정 → 보안 → 타사 앱 액세스에서 앱 삭제 후 재로그인");
    }

    // 2️⃣ Access token으로 사용자 정보 조회
    console.log("2️⃣ 사용자 정보 조회 중...");
    const userInfo = await getUserInfo(tokenData.access_token);

    // 3️⃣ 토큰 저장 (이메일을 사용자 ID로 사용)
    console.log("3️⃣ 토큰 저장 중...");
    const token: GoogleOAuthToken = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type || "Bearer",
      expiry_date: tokenData.expiry_date,
      scope: tokenData.scope,
    };

    tokenStorage.save(userInfo.email, token);

    console.log("✅ 인증 완료");
    console.log("📊 저장된 토큰 수:", tokenStorage.size());

    // 4️⃣ 성공 응답
    return NextResponse.json(
      {
        success: true,
        user: userInfo,
        message: `${userInfo.name}님이 로그인했습니다`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Callback 처리 실패:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Callback 처리에 실패했습니다",
      },
      { status: 500 }
    );
  }
}
