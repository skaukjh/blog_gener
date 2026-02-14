import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 블로그 홈 이웃새글 일괄 좋아요 API
 * 로컬 개발 환경에서만 작동
 *
 * 요청 형식:
 * POST /api/neighbor/like-home
 * {
 *   "blogId": "user_blog_id",
 *   "blogPassword": "password"
 * }
 */

// 클라이언트에서 실행할 Playwright 자동화 함수
async function autoLikeNeighborPostsWithPlaywright(blogId: string, blogPassword: string) {
  const { chromium } = await import('playwright');

  let browser = null;
  try {
    // 브라우저 시작
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // 로그인
    console.log('[Browser] 네이버 로그인 중...');
    await page.goto('https://nid.naver.com/nidlogin.login', {
      waitUntil: 'domcontentloaded',
    });

    await page.locator('input[name="id"]').fill(blogId);
    await page.waitForTimeout(500);
    await page.locator('input[name="pw"]').fill(blogPassword);
    await page.waitForTimeout(500);

    const loginButton = await page.locator('button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 완료 대기
    console.log('[Browser] 로그인 완료 대기 중...');
    let loginSuccess = false;
    for (let i = 0; i < 120; i++) {
      const url = page.url();
      if (!url.includes('nid.naver.com/nidlogin.login')) {
        loginSuccess = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!loginSuccess) {
      throw new Error('로그인에 실패했습니다. ID/PW를 확인하세요.');
    }

    // 이웃새글 홈으로 이동
    console.log('[Browser] 이웃새글 홈으로 이동 중...');
    await page.goto(
      'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(2000);

    // 이웃새글 자동 좋아요 (클라이언트 사이드 실행)
    const startTime = new Date();
    const results = await page.evaluate(async () => {
      const details: Array<{
        page: number;
        title: string;
        liked: boolean;
        reason?: string;
      }> = [];

      let currentPage = 1;
      let hasNextPage = true;
      let totalProcessed = 0;
      let totalLiked = 0;

      while (hasNextPage) {
        console.log(`페이지 ${currentPage} 처리 중...`);

        // 글 제목과 좋아요 버튼 찾기
        const items: Array<{ title: string; button: HTMLElement }> = [];

        const h3 = Array.from(document.querySelectorAll('h3')).find((h) =>
          h.textContent?.includes('이웃새글')
        );
        if (!h3) {
          break;
        }

        let container = h3.parentElement;
        while (container && !((container as HTMLElement).querySelector('[class*="list"]') !== null)) {
          container = container.parentElement;
        }

        if (!container) {
          break;
        }

        // 좋아요 버튼과 제목 매칭
        const likeButtons = Array.from(container.querySelectorAll('a.u_likeit_button._face'));

        likeButtons.forEach((btn, idx) => {
          const titleElement = (btn as HTMLElement)
            .closest('[class*="info"]')
            ?.querySelector('strong');
          const title = titleElement?.textContent?.trim() || `[제목 없음 #${idx + 1}]`;

          items.push({
            title,
            button: btn as HTMLElement,
          });
        });

        // 각 글의 좋아요 처리
        for (const item of items) {
          const ariaPressed = item.button.getAttribute('aria-pressed');
          totalProcessed++;

          if (ariaPressed === 'true') {
            details.push({
              page: currentPage,
              title: item.title,
              liked: false,
              reason: '이미 좋아요됨',
            });
          } else {
            try {
              item.button.click();
              totalLiked++;
              details.push({
                page: currentPage,
                title: item.title,
                liked: true,
              });
              await new Promise((r) => setTimeout(r, 300));
            } catch (err) {
              details.push({
                page: currentPage,
                title: item.title,
                liked: false,
                reason: err instanceof Error ? err.message : '클릭 실패',
              });
            }
          }
        }

        // 다음 페이지 확인
        const nextButton = Array.from(document.querySelectorAll('a')).find(
          (a) => a.textContent?.trim() === '다음'
        ) as HTMLElement | undefined;
        const canGoNext =
          !!nextButton && nextButton.getAttribute('aria-disabled') !== 'true';

        if (canGoNext) {
          nextButton?.click();
          await new Promise((r) => setTimeout(r, 2000));
          currentPage++;
        } else {
          hasNextPage = false;
        }
      }

      return {
        totalPages: currentPage,
        totalProcessed,
        totalLiked,
        totalFailed: details.filter((d) => !d.liked && d.reason !== '이미 좋아요됨').length,
        details,
      };
    });

    const endTime = new Date();

    return {
      success: true,
      totalPages: results.totalPages,
      totalProcessed: results.totalProcessed,
      totalLiked: results.totalLiked,
      totalFailed: results.totalFailed,
      startedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
      details: results.details,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // ⚠️ 로컬 환경만 허용
    const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

    if (!isLocal) {
      return NextResponse.json(
        {
          success: false,
          error: '이 기능은 로컬 개발 환경에서만 사용 가능합니다.',
          totalPages: 0,
          totalProcessed: 0,
          totalLiked: 0,
          totalFailed: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          details: [],
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { blogId, blogPassword } = body;

    if (!blogId || !blogPassword) {
      return NextResponse.json(
        {
          success: false,
          error: '블로그 ID와 비밀번호를 입력하세요.',
          totalPages: 0,
          totalProcessed: 0,
          totalLiked: 0,
          totalFailed: 0,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          details: [],
        },
        { status: 400 }
      );
    }

    console.log('\n========== 네이버 블로그 이웃새글 일괄 좋아요 시작 ==========');
    console.log(`시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log('=========================================================\n');

    const timeoutId = setTimeout(() => {
      throw new Error('처리 시간 초과 (30분)');
    }, 30 * 60 * 1000);

    try {
      const result = await autoLikeNeighborPostsWithPlaywright(blogId, blogPassword);

      clearTimeout(timeoutId);

      console.log('\n========== 처리 완료 ==========');
      console.log(`성공: ${result.success}`);
      console.log(`처리 페이지: ${result.totalPages}개`);
      console.log(`처리된 글: ${result.totalProcessed}개`);
      console.log(`좋아요 완료: ${result.totalLiked}개`);
      console.log(`실패: ${result.totalFailed}개`);
      console.log('================================\n');

      return NextResponse.json(result);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    console.error('\n========== 오류 발생 ==========');
    console.error(`오류: ${errorMessage}`);
    console.error('================================\n');

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        totalPages: 0,
        totalProcessed: 0,
        totalLiked: 0,
        totalFailed: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        details: [],
      },
      { status: 500 }
    );
  }
}
