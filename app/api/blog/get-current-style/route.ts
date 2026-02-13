// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { readBlogStyleFromGoogleDrive } from "@/lib/utils/google-drive";

export async function GET() {
  try {
    const style = await readBlogStyleFromGoogleDrive();

    if (!style) {
      return NextResponse.json(
        {
          success: false,
          style: null,
          exists: false,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        style,
        exists: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Google Drive 스타일 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        style: null,
        exists: false,
      },
      { status: 200 }
    );
  }
}
