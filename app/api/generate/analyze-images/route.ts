import { NextRequest, NextResponse } from "next/server";
import { analyzeAllImages } from "@/lib/openai/image-analyzer";
import type { AnalyzeImagesRequest, AnalyzeImagesResponse } from "@/types/index";

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeImagesResponse>> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          analysis: { images: [], overall: { theme: "", style: "", suggestions: [] }, costEstimate: 0 },
          error: "OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.",
        },
        { status: 500 }
      );
    }

    let body: AnalyzeImagesRequest;

    try {
      body = await request.json();
    } catch (parseError) {
      console.error("요청 본문 파싱 실패:", parseError);
      return NextResponse.json(
        {
          success: false,
          analysis: { images: [], overall: { theme: "", style: "", suggestions: [] }, costEstimate: 0 },
          error: "요청 데이터가 손상되었습니다. 이미지를 다시 업로드해주세요.",
        },
        { status: 400 }
      );
    }

    const { images, topic } = body;

    if (!images || images.length === 0) {
      return NextResponse.json(
        {
          success: false,
          analysis: { images: [], overall: { theme: "", style: "", suggestions: [] }, costEstimate: 0 },
          error: "분석할 이미지가 없습니다",
        },
        { status: 400 }
      );
    }

    if (images.length > 25) {
      return NextResponse.json(
        {
          success: false,
          analysis: { images: [], overall: { theme: "", style: "", suggestions: [] }, costEstimate: 0 },
          error: "최대 25장까지만 업로드 가능합니다",
        },
        { status: 400 }
      );
    }

    // 이미지 데이터 검증
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img || typeof img !== 'string' || !img.startsWith('data:image/')) {
        console.error(`이미지 ${i + 1}가 유효하지 않음:`, img?.substring(0, 100));
        return NextResponse.json(
          {
            success: false,
            analysis: { images: [], overall: { theme: "", style: "", suggestions: [] }, costEstimate: 0 },
            error: `이미지 ${i + 1}이 손상되었습니다. 다시 업로드해주세요.`,
          },
          { status: 400 }
        );
      }
    }

    // 이미지 분석
    const analysis = await analyzeAllImages(images, topic);

    return NextResponse.json(
      {
        success: true,
        analysis,
        message: `${images.length}개의 이미지 분석이 완료되었습니다`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("이미지 분석 오류:", error);
    const errorMessage = error instanceof Error ? error.message : "이미지를 분석할 수 없습니다";

    // JSON 파싱 에러 등 특정 에러에 대한 사용자 안내
    if (errorMessage.includes("JSON") || errorMessage.includes("Unterminated")) {
      return NextResponse.json(
        {
          success: false,
          analysis: { images: [], overall: { theme: "", style: "", suggestions: [] }, costEstimate: 0 },
          error: "이미지 데이터가 손상되었습니다. 이미지를 다시 업로드한 후 시도해주세요.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        analysis: { images: [], overall: { theme: "", style: "", suggestions: [] }, costEstimate: 0 },
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
