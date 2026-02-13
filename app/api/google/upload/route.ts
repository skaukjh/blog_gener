// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { uploadFileToDrive } from "@/lib/utils/google-drive-upload";

interface UploadRequest {
  userEmail: string;
  fileName: string;
  fileContent: string;
  mimeType?: string;
}

interface UploadResponse {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  message?: string;
  error?: string;
}

/**
 * POST /api/google/upload
 * Google Drive에 파일 업로드
 *
 * Request Body:
 * {
 *   "userEmail": "user@example.com",
 *   "fileName": "blog_style.txt",
 *   "fileContent": "파일 내용",
 *   "mimeType": "text/plain" (선택사항)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "fileId": "file123...",
 *   "webViewLink": "https://drive.google.com/file/d/file123/view"
 * }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse>> {
  try {
    const body: UploadRequest = await request.json();

    const { userEmail, fileName, fileContent, mimeType = "text/plain" } = body;

    // 입력 검증
    if (!userEmail || !fileName || !fileContent) {
      return NextResponse.json(
        {
          success: false,
          error: "userEmail, fileName, fileContent가 필요합니다",
        },
        { status: 400 }
      );
    }

    console.log(`📤 파일 업로드 요청 - ${fileName} (${userEmail})`);

    // Google Drive에 업로드
    const fileId = await uploadFileToDrive(
      userEmail,
      fileName,
      fileContent,
      mimeType
    );

    const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;

    return NextResponse.json(
      {
        success: true,
        fileId,
        webViewLink,
        message: `파일이 Google Drive에 업로드되었습니다: ${fileName}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 파일 업로드 실패:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "파일 업로드에 실패했습니다",
      },
      { status: 500 }
    );
  }
}
