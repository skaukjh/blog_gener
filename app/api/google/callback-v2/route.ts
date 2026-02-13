// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getUserInfo,
} from "@/lib/utils/google-oauth-client-v2";
import tokenStorage from "@/lib/utils/google-token-storage-single-user";
import type { GoogleCallbackResponse } from "@/types/index";

/**
 * GET /api/google/callback-v2
 *
 * ✅ 개선사항:
 * 1. state 파라미터 검증 (CSRF 방지)
 * 2. refresh_token 최초 발급 확인
 * 3. 명확한 에러 메시지
 * 4. 자동 갱신 시 새 refresh_token 저장
 *
 * 🚨 주의사항:
 * - state는 세션에 저장했던 값과 비교해야 함
 * - 현재는 단순화 버전 (state 검증 스킵)
 * - 프로덕션에서는 세션 저장 필수
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GoogleCallbackResponse>> {
  try {
    // Query parameter 추출
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    console.log("🔐 Google Callback 수신");

    // 1️⃣ 에러 확인
    if (error) {
      const errorDescription = searchParams.get("error_description") || error;
      console.error("❌ 사용자가 인증을 거부했습니다:", error);

      return NextResponse.json(
        {
          success: false,
          error: `인증 거부됨: ${errorDescription}`,
        },
        { status: 400 }
      );
    }

    // 2️⃣ Authorization code 확인
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

    // 3️⃣ CSRF 검증 (state 파라미터)
    // ⚠️ 주의: 프로덕션에서는 세션에서 저장된 state를 비교해야 함
    if (state) {
      console.log("🔐 state 파라미터 검증:");
      console.log(`   받은 state: ${state.substring(0, 20)}...`);
      // 세션에서 저장된 state를 가져와서 검증
      // validateState(state, sessionState);
    } else {
      console.warn("⚠️ state 파라미터가 없습니다 (CSRF 위험)");
    }

    // 4️⃣ Authorization code를 token으로 교환
    console.log("1️⃣ Authorization code 교환...");
    let tokenData;
    try {
      tokenData = await exchangeCodeForToken(code);
    } catch (exchangeError) {
      const message =
        exchangeError instanceof Error
          ? exchangeError.message
          : "Token 교환 실패";

      console.error("❌ Token 교환 실패:", message);

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 400 }
      );
    }

    // 5️⃣ refresh_token 확인 (critical!)
    console.log("2️⃣ refresh_token 확인...");
    if (!tokenData.refresh_token) {
      console.error("❌ ⚠️ ⚠️ refresh_token을 받지 못했습니다! ⚠️ ⚠️");
      console.error(
        "이것이 나중에 자동화를 완전히 불가능하게 만들 수 있습니다!"
      );
      console.error("");
      console.error("원인 및 해결책:");
      console.error("─────────────────────────────────────────");
      console.error(
        "1. 처음 로그인이지만 prompt=consent 옵션이 없는 경우"
      );
      console.error("   → callback API의 generateAuthUrl 함수 확인");
      console.error("");
      console.error("2. 이전에 이미 로그인했던 경우");
      console.error(
        "   → Google 계정 → 보안 → 타사 앱 액세스에서 앱 삭제"
      );
      console.error("   → 다시 로그인");
      console.error("─────────────────────────────────────────");

      return NextResponse.json(
        {
          success: false,
          error:
            "refresh_token을 받지 못했습니다. 위의 해결책을 따르고 다시 로그인하세요.",
        },
        { status: 400 }
      );
    }

    console.log("✅ refresh_token 정상 발급됨!");

    // 6️⃣ 사용자 정보 조회
    console.log("3️⃣ 사용자 정보 조회...");
    let userInfo;
    try {
      userInfo = await getUserInfo(tokenData.access_token);
    } catch (userError) {
      const message =
        userError instanceof Error
          ? userError.message
          : "사용자 정보 조회 실패";

      console.error("❌ 사용자 정보 조회 실패:", message);

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 400 }
      );
    }

    // 7️⃣ Token 저장 (영구 저장!)
    console.log("4️⃣ Token 저장...");
    try {
      tokenStorage.saveInitialToken({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date,
        scope: tokenData.scope,
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Token 저장 실패";

      console.error("❌ Token 저장 실패:", message);

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 400 }
      );
    }

    console.log("✅ 전체 인증 완료!");
    console.log("📊 저장 정보:", {
      사용자: userInfo.email,
      refresh_token: "✅ (영구 저장됨)",
      자동화: "✅ 이제 가능",
    });

    // 8️⃣ 성공 응답
    return NextResponse.json(
      {
        success: true,
        user: userInfo,
        message: `${userInfo.name}님이 성공적으로 로그인했습니다!\n자동 업로드가 활성화되었습니다.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Callback 처리 중 예상치 못한 에러:", error);

    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 에러 발생";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
