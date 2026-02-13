import { NextRequest, NextResponse } from "next/server";
import { generateBlogContent, calculateGenerationCost } from "@/lib/openai/content-generator";
import type { CreateContentRequest, CreateContentResponse } from "@/types/index";

export async function POST(request: NextRequest): Promise<NextResponse<CreateContentResponse>> {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        content: { content: "", imageGuides: [], wordCount: 0, keywordCounts: {} },
        cost: { usd: 0, krw: 0, breakdown: { imageAnalysis: { usd: 0, krw: 0 }, contentGeneration: { usd: 0, krw: 0 } } },
        error: "OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.",
      },
      { status: 500 }
    );
  }

  let body: CreateContentRequest | null = null;
  try {
    body = await request.json();

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          content: { content: "", imageGuides: [], wordCount: 0, keywordCounts: {} },
          cost: { usd: 0, krw: 0, breakdown: { imageAnalysis: { usd: 0, krw: 0 }, contentGeneration: { usd: 0, krw: 0 } } },
          error: "요청 본문이 없습니다",
        },
        { status: 400 }
      );
    }

    const { topic, length, keywords, imageAnalysis, startSentence, endSentence, placeInfo } = body;

    // 필수 필드 검증
    if (!topic || !length || !keywords || !imageAnalysis) {
      return NextResponse.json(
        {
          success: false,
          content: { content: "", imageGuides: [], wordCount: 0, keywordCounts: {} },
          cost: { usd: 0, krw: 0, breakdown: { imageAnalysis: { usd: 0, krw: 0 }, contentGeneration: { usd: 0, krw: 0 } } },
          error: "필수 필드가 누락되었습니다",
        },
        { status: 400 }
      );
    }

    // 콘텐츠 생성
    // 주의: 스타일은 더 이상 전달하지 않습니다.
    // Assistant의 instruction에 저장된 스타일을 사용합니다. (토큰 절약)
    const content = await generateBlogContent(
      topic,
      length,
      keywords,
      imageAnalysis,
      startSentence,
      endSentence,
      placeInfo
    );

    // 비용 계산 (USD)
    // 이미지 분석 비용: 약 이미지당 170 tokens (detail: high)
    const imageAnalysisCost = imageAnalysis.images.length * (170 * 2.5 / 1000000);

    // 콘텐츠 생성 비용: 입력 약 1200 tokens + 출력 약 2500 tokens
    const contentGenerationInputTokens = 1200;
    const contentGenerationOutputTokens = Math.ceil(content.wordCount / 3.5); // 대략 한글 글자수를 토큰으로 변환
    const contentGenerationCost = calculateGenerationCost(
      contentGenerationInputTokens,
      contentGenerationOutputTokens
    );

    const totalCostUSD = imageAnalysisCost + contentGenerationCost;
    const totalCostKRW = Math.round(totalCostUSD * 1300); // USD to KRW (1 USD = 약 1300 KRW)

    return NextResponse.json(
      {
        success: true,
        content,
        cost: {
          usd: parseFloat(totalCostUSD.toFixed(4)),
          krw: totalCostKRW,
          breakdown: {
            imageAnalysis: {
              usd: parseFloat(imageAnalysisCost.toFixed(4)),
              krw: Math.round(imageAnalysisCost * 1300),
            },
            contentGeneration: {
              usd: parseFloat(contentGenerationCost.toFixed(4)),
              krw: Math.round(contentGenerationCost * 1300),
            },
          },
        },
        message: "블로그 글 생성이 완료되었습니다",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("콘텐츠 생성 오류:", error);
    const errorMessage = error instanceof Error ? error.message : "콘텐츠를 생성할 수 없습니다";

    // 콘텐츠가 너무 큰 경우에 대한 예외 처리
    if ((errorMessage.includes("JSON") || errorMessage.includes("마커")) && body) {
      console.error("콘텐츠 생성 상세 정보:", {
        topicLength: (body as CreateContentRequest).topic?.length,
        imageCount: (body as CreateContentRequest).imageAnalysis?.images?.length,
        keywordCount: (body as CreateContentRequest).keywords?.length,
      });
    }

    return NextResponse.json(
      {
        success: false,
        content: { content: "", imageGuides: [], wordCount: 0, keywordCounts: {} },
        cost: { usd: 0, krw: 0, breakdown: { imageAnalysis: { usd: 0, krw: 0 }, contentGeneration: { usd: 0, krw: 0 } } },
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
