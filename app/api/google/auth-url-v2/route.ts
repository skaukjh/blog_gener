// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { generateAuthUrl, generateState } from "@/lib/utils/google-oauth-client-v2";
import type { GoogleAuthUrlResponse } from "@/types/index";

/**
 * GET /api/google/auth-url-v2
 *
 * Google OAuth 2.0 인증 URL 생성
 *
 * ✅ 개선사항:
 * 1. CSRF 방지를 위한 state 파라미터 생성
 * 2. access_type=offline (refresh_token 요청)
 * 3. prompt=consent (매번 동의 화면 표시)
 * 4. drive.file scope (최소 권한)
 *
 * 응답 형식:
 * {
 *   "success": true,
 *   "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
 *   "state": "abcd1234...",
 *   "message": "Google 로그인 페이지로 이동하세요"
 * }
 *
 * 프론트엔드에서:
 * 1. /api/google/auth-url-v2로 요청
 * 2. authUrl을 window.location.href에 설정
 * 3. 사용자가 Google 로그인
 * 4. /api/google/callback-v2로 리다이렉트
 */
export async function GET(): Promise<NextResponse<GoogleAuthUrlResponse>> {
  try {
    console.log("🔐 Google OAuth 인증 URL 생성 요청");

    // 1️⃣ CSRF 방지를 위한 state 생성
    const state = generateState();
    console.log(`✅ state 생성 완료: ${state.substring(0, 20)}...`);

    // 2️⃣ 인증 URL 생성
    const authUrl = generateAuthUrl(state);

    // 3️⃣ state를 세션/쿠키에 저장
    // ⚠️ TODO: 프로덕션에서는 Redis나 DB에 state를 저장하고
    // callback-v2에서 검증해야 함 (현재는 단순화 버전)
    console.log("📌 주의: state를 세션에 저장해야 합니다 (프로덕션)");

    console.log("✅ 인증 URL 생성 완료");

    return NextResponse.json(
      {
        success: true,
        authUrl,
        state,
        message: "Google 로그인 페이지로 이동하세요",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 인증 URL 생성 실패:", error);

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
