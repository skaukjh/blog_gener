// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/utils/google-oauth-client";
import type { GoogleAuthUrlResponse } from "@/types/index";

/**
 * GET /api/google/auth-url
 * Google OAuth 2.0 인증 URL 생성
 *
 * 응답:
 * {
 *   "success": true,
 *   "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
 * }
 */
export async function GET(): Promise<NextResponse<GoogleAuthUrlResponse>> {
  try {
    console.log("🔐 Google 인증 URL 생성 요청");

    const authUrl = generateAuthUrl();

    console.log("✅ 인증 URL 생성 완료");
    console.log("🔗 URL:", authUrl.substring(0, 80) + "...");

    return NextResponse.json(
      {
        success: true,
        url: authUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 인증 URL 생성 실패:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "인증 URL 생성에 실패했습니다",
      },
      { status: 500 }
    );
  }
}
