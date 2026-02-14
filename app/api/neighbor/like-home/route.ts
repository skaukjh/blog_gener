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
  const details: Array<{
    page: number;
    title: string;
    liked: boolean;
    reason?: string;
  }> = [];

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

    // 페이지별 처리
    const startTime = new Date();
    let currentPageNum = 1;
    let totalProcessed = 0;
    let totalLiked = 0;
    let hasNextPage = true;

    while (hasNextPage && currentPageNum <= 10) {
      console.log(`\n========== 페이지 ${currentPageNum} 처리 ==========`);

      // 좋아요 버튼 모두 찾기
      const likeButtonLocators = await page.locator('a.u_likeit_button._face').all();
      console.log(`찾은 좋아요 버튼: ${likeButtonLocators.length}개`);

      if (likeButtonLocators.length === 0) {
        console.log('[종료] 좋아요 버튼을 찾을 수 없습니다');
        break;
      }

      // 각 버튼마다 개별 처리
      for (let i = 0; i < likeButtonLocators.length; i++) {
        const buttonLocator = likeButtonLocators[i];

        try {
          // 현재 상태 확인
          const ariaPressed = await buttonLocator.getAttribute('aria-pressed');
          const isAlreadyLiked = ariaPressed === 'true';

          // 제목 추출 - 더 정교한 방법
          let title = `글 #${i + 1}`;

          try {
            // 방법 1: 가장 가까운 article 또는 div[class*="item"] 찾기
            const itemContainer = await buttonLocator.locator('xpath=ancestor::article | ancestor::div[contains(@class, "item")] | ancestor::div[contains(@class, "post")] | ancestor::li').first();

            // 방법 2: strong 태그 찾기 (제목이 보통 strong 안에)
            const titleElement = await itemContainer.locator('strong').first();
            const titleText = await titleElement.textContent();

            if (titleText && titleText.trim().length > 0 && titleText.trim().length < 150) {
              title = titleText.trim();
            } else {
              // 방법 3: a 태그의 텍스트 사용 (제목 링크)
              const linkText = await itemContainer.locator('a').first().textContent();
              if (linkText && linkText.trim().length > 0 && linkText.trim().length < 150) {
                title = linkText.trim();
              }
            }
          } catch (e) {
            // 에러 무시, 기본값 사용
          }

          totalProcessed++;
          console.log(`[${currentPageNum}-${i + 1}] "${title}" - 상태: ${isAlreadyLiked ? '✅이미좋아요' : '⭕미처리'}`);

          if (isAlreadyLiked) {
            details.push({
              page: currentPageNum,
              title: title.trim(),
              liked: false,
              reason: '이미 좋아요됨',
            });
          } else {
            // 좋아요 클릭
            await buttonLocator.click();
            console.log(`[${currentPageNum}-${i + 1}] 클릭 완료`);

            // 페이지 안정화 대기
            await page.waitForTimeout(600);

            // 클릭 후 상태 재확인
            const newAriaPressed = await buttonLocator.getAttribute('aria-pressed');
            const likeSucceeded = newAriaPressed === 'true';

            if (likeSucceeded) {
              totalLiked++;
              console.log(`[${currentPageNum}-${i + 1}] ✅ 좋아요 성공`);
              details.push({
                page: currentPageNum,
                title: title.trim(),
                liked: true,
              });
            } else {
              console.log(`[${currentPageNum}-${i + 1}] ❌ 좋아요 미적용`);
              details.push({
                page: currentPageNum,
                title: title.trim(),
                liked: false,
                reason: '클릭 후에도 상태 미변경',
              });
            }
          }
        } catch (err) {
          console.log(`[${currentPageNum}-${i + 1}] 오류: ${err}`);
          details.push({
            page: currentPageNum,
            title: `[오류 발생 #${i + 1}]`,
            liked: false,
            reason: err instanceof Error ? err.message : '처리 실패',
          });
        }
      }

      // 다음 페이지 찾기 (AngularJS 기반 페이지네이션)
      console.log(`\n[Page ${currentPageNum}] 다음 페이지 확인 중...`);

      try {
        // 현재 페이지 찾기: aria-current="page" 속성
        const currentPageLink = page.locator('a.item[aria-current="page"]').first();
        const currentPageText = await currentPageLink.locator('strong').textContent();
        console.log(`현재 페이지: ${currentPageText}`);

        // 모든 페이지 링크 찾기
        const allPageLinks = await page.locator('a.item[aria-label*="페이지"]').all();
        console.log(`찾은 페이지 링크: ${allPageLinks.length}개`);

        let nextPageFound = false;

        // 현재 페이지보다 번호가 큰 첫 번째 페이지 찾기
        for (const pageLink of allPageLinks) {
          const ariaLabel = await pageLink.getAttribute('aria-label');
          console.log(`페이지 링크: ${ariaLabel}`);

          // "다음" 버튼이나 다음 페이지 확인
          if (ariaLabel && (ariaLabel.includes('다음') || ariaLabel.includes('Next'))) {
            const isCurrent = await pageLink.getAttribute('aria-current');
            if (isCurrent !== 'page') {
              // 다음 페이지로 이동
              await pageLink.click();
              console.log(`[Page ${currentPageNum}] 다음 페이지로 이동...`);
              await page.waitForTimeout(2000);
              currentPageNum++;
              nextPageFound = true;
              break;
            }
          }
        }

        if (!nextPageFound) {
          // "다음" 텍스트가 있는 버튼 찾기
          const nextBtn = page.locator('a:has-text("다음")').first();
          const nextBtnVisible = await nextBtn.isVisible().catch(() => false);
          const nextBtnDisabled = await nextBtn.getAttribute('aria-disabled').catch(() => 'true');

          if (nextBtnVisible && nextBtnDisabled !== 'true') {
            await nextBtn.click();
            console.log(`[Page ${currentPageNum}] "다음" 버튼 클릭`);
            await page.waitForTimeout(2000);
            currentPageNum++;
            nextPageFound = true;
          }
        }

        if (!nextPageFound) {
          console.log('[종료] 더 이상 페이지가 없습니다');
          hasNextPage = false;
        }
      } catch (err) {
        console.log(`[Page ${currentPageNum}] 페이지 이동 오류: ${err}`);
        hasNextPage = false;
      }
    }

    const endTime = new Date();

    return {
      success: true,
      totalPages: currentPageNum,
      totalProcessed,
      totalLiked,
      totalFailed: details.filter((d) => !d.liked && d.reason !== '이미 좋아요됨').length,
      startedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
      details,
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
