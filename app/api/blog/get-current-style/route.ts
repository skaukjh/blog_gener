// ⭐ runtime은 반드시 import보다 먼저 선언해야 함
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import blogStyleCache from "@/lib/utils/blog-style-memory-cache";

export async function GET() {
  try {
    // 메모리 캐시에서 스타일 조회
    const style = blogStyleCache.get();

    if (!style) {
      return NextResponse.json(
        {
          success: false,
          style: null,
          exists: false,
          message: "저장된 스타일이 없습니다",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        style,
        exists: true,
        cacheInfo: blogStyleCache.getInfo(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("스타일 조회 오류:", error);
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
