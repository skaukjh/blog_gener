import { getRecommendations } from '@/lib/search/recommendations';
import { RecommendationResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/search/recommendations
 * 전문가별 추천 아이템 검색
 *
 * Request:
 * {
 *   query: string,
 *   expertType: 'restaurant' | 'product' | 'travel' | 'fashion' | 'living',
 *   recommendationType: 'nearby' | 'related' | 'destination',
 *   limit?: number
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<RecommendationResponse>> {
  try {
    const body = await request.json();
    const { query, expertType, recommendationType, limit = 5 } = body;

    if (!query || !expertType) {
      return NextResponse.json(
        {
          success: false,
          recommendations: [],
          expertType,
          error: '검색 쿼리와 전문가 타입을 입력해주세요',
        } as RecommendationResponse,
        { status: 400 }
      );
    }

    // 추천 검색
    const recommendations = await getRecommendations({
      query,
      expertType,
      recommendationType,
      limit,
    });

    return NextResponse.json({
      success: true,
      recommendations,
      expertType,
    });
  } catch (error) {
    console.error('Recommendations API error:', error);
    const errorMessage = error instanceof Error ? error.message : '추천 검색 중 오류가 발생했습니다';

    return NextResponse.json(
      {
        success: false,
        recommendations: [],
        expertType: 'restaurant',
        error: errorMessage,
      } as RecommendationResponse,
      { status: 500 }
    );
  }
}
