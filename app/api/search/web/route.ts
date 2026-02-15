import { webSearch } from '@/lib/search/web-search';
import { extractFacts } from '@/lib/search/fact-extractor';
import { WebSearchResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/search/web
 * 네이버 또는 구글에서 웹 검색
 *
 * Request:
 * {
 *   query: string,
 *   searchEngine: 'naver' | 'google',
 *   limit?: number,
 *   extractFacts?: boolean
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<WebSearchResponse>> {
  try {
    const body = await request.json();
    const { query, searchEngine = 'naver', limit = 5, extractFacts: shouldExtractFacts = false } = body;

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          query: '',
          source: searchEngine,
          error: '검색 쿼리를 입력해주세요',
        } as WebSearchResponse,
        { status: 400 }
      );
    }

    // 웹 검색
    const results = await webSearch(query, searchEngine as 'naver' | 'google', limit);

    // 팩트 추출 (선택사항)
    if (shouldExtractFacts && results.length > 0) {
      const factResult = await extractFacts(query, results, 'gpt-4o-mini');
      console.log(`팩트 추출 완료: ${factResult.facts.length}개 팩트, 신뢰도 ${factResult.confidence}%`);
    }

    return NextResponse.json({
      success: true,
      results,
      query,
      source: searchEngine as 'naver' | 'google',
    });
  } catch (error) {
    console.error('Web search API error:', error);
    const errorMessage = error instanceof Error ? error.message : '검색 중 오류가 발생했습니다';

    return NextResponse.json(
      {
        success: false,
        results: [],
        query: '',
        source: 'naver',
        error: errorMessage,
      } as WebSearchResponse,
      { status: 500 }
    );
  }
}
