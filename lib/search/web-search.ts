import { WebSearchResult } from '@/types';

/**
 * Phase 20: 웹 검색 통합
 * 네이버 + 구글 검색 API 지원
 */

interface NaverSearchResponse {
  items: Array<{
    title: string;
    link: string;
    description: string;
  }>;
}

interface GoogleSearchResponse {
  items: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
}

/**
 * 네이버 검색 API
 */
export async function searchNaver(query: string, limit: number = 5): Promise<WebSearchResult[]> {
  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Naver API credentials not configured');
    }

    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${limit}&sort=sim`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.status}`);
    }

    const data: NaverSearchResponse = await response.json();

    return data.items.map((item) => ({
      title: stripHtmlTags(item.title),
      url: item.link,
      snippet: stripHtmlTags(item.description),
      source: 'naver' as const,
    }));
  } catch (error) {
    console.error('Naver search error:', error);
    throw error;
  }
}

/**
 * 구글 검색 API (Custom Search)
 */
export async function searchGoogle(query: string, limit: number = 5): Promise<WebSearchResult[]> {
  try {
    const cseId = process.env.GOOGLE_CSE_ID;
    const apiKey = process.env.GOOGLE_CSE_API_KEY;

    if (!cseId || !apiKey) {
      throw new Error('Google CSE credentials not configured');
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=${Math.min(limit, 10)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data: GoogleSearchResponse = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.slice(0, limit).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'google' as const,
    }));
  } catch (error) {
    console.error('Google search error:', error);
    throw error;
  }
}

/**
 * 통합 검색 함수
 */
export async function webSearch(
  query: string,
  searchEngine: 'naver' | 'google' = 'naver',
  limit: number = 5
): Promise<WebSearchResult[]> {
  if (searchEngine === 'naver') {
    return searchNaver(query, limit);
  } else {
    return searchGoogle(query, limit);
  }
}

/**
 * HTML 태그 제거
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
}

/**
 * 웹 검색 결과 요약
 */
export function summarizeSearchResults(results: WebSearchResult[]): string {
  return results
    .map(
      (result, idx) => `
[결과 ${idx + 1}]
제목: ${result.title}
URL: ${result.url}
요약: ${result.snippet}
    `
    )
    .join('\n');
}
