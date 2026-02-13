// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { uploadFileToDrive, updateFileInDrive } from "@/lib/utils/google-drive-upload-v2";

/**
 * POST /api/google/upload-v2
 *
 * Google Drive에 파일 업로드
 *
 * ✅ 개선사항:
 * 1. 자동 토큰 갱신 (refresh_token 사용)
 * 2. drive.file scope (최소 권한)
 * 3. 파일 생성 및 업데이트 지원
 * 4. 명확한 에러 처리
 *
 * 요청 형식:
 * {
 *   "fileName": "blog_content.txt",
 *   "fileContent": "블로그 글 내용...",
 *   "mimeType": "text/plain" (선택사항)
 * }
 *
 * 응답 형식:
 * {
 *   "success": true,
 *   "fileId": "1abc2def3ghi4jkl5mno6pqr7stu8vwx",
 *   "message": "파일 업로드 완료"
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log("📤 Google Drive 파일 업로드 요청");

    // 1️⃣ 요청 본문 파싱
    const body = await request.json();
    const { fileName, fileContent, mimeType = "text/plain" } = body;

    // 2️⃣ 필수 파라미터 검증
    if (!fileName) {
      console.error("❌ fileName이 없습니다");
      return NextResponse.json(
        {
          success: false,
          error: "fileName은 필수 파라미터입니다",
        },
        { status: 400 }
      );
    }

    if (!fileContent) {
      console.error("❌ fileContent가 없습니다");
      return NextResponse.json(
        {
          success: false,
          error: "fileContent는 필수 파라미터입니다",
        },
        { status: 400 }
      );
    }

    console.log(`📝 파일 정보: ${fileName} (${mimeType})`);

    // 3️⃣ Google Drive에 업로드
    const fileId = await uploadFileToDrive(fileName, fileContent, mimeType);

    console.log("✅ 파일 업로드 완료");

    // 4️⃣ 성공 응답
    return NextResponse.json(
      {
        success: true,
        fileId,
        message: "파일이 성공적으로 업로드되었습니다",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 파일 업로드 실패:", error);

    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 에러 발생";

    // 토큰 관련 에러 처리
    if (errorMessage.includes("저장된 토큰이 없습니다")) {
      return NextResponse.json(
        {
          success: false,
          error: "먼저 Google 계정으로 로그인해주세요",
          code: "NO_TOKEN",
        },
        { status: 401 }
      );
    }

    // Refresh token 문제
    if (errorMessage.includes("Refresh token")) {
      return NextResponse.json(
        {
          success: false,
          error: "토큰을 갱신할 수 없습니다. 다시 로그인해주세요",
          code: "REFRESH_TOKEN_ERROR",
        },
        { status: 401 }
      );
    }

    // 기타 에러
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/google/upload-v2
 *
 * Google Drive의 파일 업데이트
 *
 * 요청 형식:
 * {
 *   "fileId": "1abc2def3ghi4jkl5mno6pqr7stu8vwx",
 *   "fileContent": "업데이트된 블로그 글...",
 *   "mimeType": "text/plain" (선택사항)
 * }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    console.log("📝 Google Drive 파일 업데이트 요청");

    const body = await request.json();
    const { fileId, fileContent, mimeType = "text/plain" } = body;

    // 필수 파라미터 검증
    if (!fileId) {
      return NextResponse.json(
        {
          success: false,
          error: "fileId는 필수 파라미터입니다",
        },
        { status: 400 }
      );
    }

    if (!fileContent) {
      return NextResponse.json(
        {
          success: false,
          error: "fileContent는 필수 파라미터입니다",
        },
        { status: 400 }
      );
    }

    // 파일 업데이트
    await updateFileInDrive(fileId, fileContent, mimeType);

    console.log("✅ 파일 업데이트 완료");

    return NextResponse.json(
      {
        success: true,
        message: "파일이 성공적으로 업데이트되었습니다",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 파일 업데이트 실패:", error);

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
