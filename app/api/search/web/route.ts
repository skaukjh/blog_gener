import { webSearch, webSearchBoth } from '@/lib/search/web-search';
import { extractFacts } from '@/lib/search/fact-extractor';
import { WebSearchResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/search/web
 * 웹 검색 (Naver + Google)
 *
 * Request:
 * {
 *   query: string,
 *   searchEngine?: 'naver' | 'google' | 'both' (기본값: 'both'),
 *   limit?: number,
 *   extractFacts?: boolean
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<WebSearchResponse>> {
  try {
    const body = await request.json();
    const { query, searchEngine = 'both', limit = 5, extractFacts: shouldExtractFacts = false } = body;

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          query: '',
          source: 'both',
          error: '검색 쿼리를 입력해주세요',
        } as WebSearchResponse,
        { status: 400 }
      );
    }

    let results;

    // 웹 검색
    if (searchEngine === 'both') {
      // Naver + Google 동시 검색 (기본)
      results = await webSearchBoth(query, limit);
    } else {
      // 단일 엔진 검색
      results = await webSearch(query, searchEngine as 'naver' | 'google', limit);
    }

    // 팩트 추출 (선택사항)
    if (shouldExtractFacts && results.length > 0) {
      const factResult = await extractFacts(query, results, 'gpt-4o-mini');
      console.log(`팩트 추출 완료: ${factResult.facts.length}개 팩트, 신뢰도 ${factResult.confidence}%`);
    }

    return NextResponse.json({
      success: true,
      results,
      query,
      source: searchEngine as 'naver' | 'google' | 'both',
    });
  } catch (error) {
    console.error('Web search API error:', error);
    const errorMessage = error instanceof Error ? error.message : '검색 중 오류가 발생했습니다';

    // 부분 실패도 반환 (한 엔진만 실패했을 수 있음)
    return NextResponse.json(
      {
        success: false,
        results: [],
        query: '',
        source: 'both',
        error: errorMessage,
      } as WebSearchResponse,
      { status: 500 }
    );
  }
}
