import { chromium } from 'playwright';

/**
 * Playwright 기반 네이버 블로그 자동화
 * - 실제 크롬 브라우저 실행 (헤드리스 아님)
 * - 메모리에만 계정 정보 유지
 * - 견고한 대기 기법 적용
 * - 로컬 개발 환경에서만 작동
 */

export interface NeighborBlogInfo {
  nickname: string;
  blogUrl: string;
  blogId: string;
}

export interface BlogPostInfo {
  title: string;
  url: string;
  date: string;
  hasLike: boolean;
}

export interface AutoLikeResult {
  success: boolean;
  totalProcessed: number;
  totalLiked: number;
  neighborStats: Array<{
    nickname: string;
    postsProcessed: number;
    postsLiked: number;
  }>;
  errors: string[];
  startedAt: string;
  completedAt: string;
}

class NaverBlogAutomation {
  private browser: any = null;
  private page: any = null;
  private isLoggedIn: boolean = false;

  /**
   * 네이버 로그인
   */
  async login(blogId: string, blogPassword: string): Promise<void> {
    try {
      console.log('[Playwright] 브라우저 시작 중...');

      // 실제 크롬 브라우저 시작 (headless: false)
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
        ],
      });

      this.page = await this.browser.newPage();

      // 타임아웃 설정
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);

      // 로그인 페이지로 이동
      console.log('[Playwright] 네이버 로그인 페이지 이동 중...');
      await this.page.goto('https://nid.naver.com/nidlogin.login', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // ID 입력 (느린 입력으로 봇 탐지 회피)
      console.log('[Playwright] 아이디 입력 중...');
      const idInput = await this.page.locator('input[name="id"]').first();
      await idInput.fill(blogId, { delay: 50 });

      // PW 입력
      console.log('[Playwright] 비밀번호 입력 중...');
      const pwInput = await this.page.locator('input[name="pw"]').first();
      await pwInput.fill(blogPassword, { delay: 50 });

      // 로그인 버튼 클릭
      console.log('[Playwright] 로그인 중...');
      await this.page.locator('button:has-text("로그인")').first().click();

      // 로그인 완료 대기
      try {
        await this.page.waitForURL('**/blog.naver.com/**', { timeout: 15000 });
        console.log('[Playwright] 로그인 성공');
        this.isLoggedIn = true;
      } catch {
        throw new Error('로그인 실패: 아이디 또는 비밀번호가 올바르지 않습니다');
      }
    } catch (error) {
      console.error('[Playwright] 로그인 오류:', error);
      await this.close();
      throw error;
    }
  }

  /**
   * 이웃 목록 가져오기
   */
  async getNeighbors(blogId: string): Promise<NeighborBlogInfo[]> {
    try {
      if (!this.isLoggedIn) {
        throw new Error('로그인되지 않았습니다');
      }

      console.log('[Playwright] 이웃 관리 페이지로 이동 중...');
      await this.page.goto(`https://blog.naver.com/${blogId}/admin/neighbors`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // 이웃 목록 로드 대기
      await this.page.waitForSelector('a[href*="/blog.naver.com/"]', { timeout: 10000 }).catch(() => {});

      // 이웃 정보 추출
      console.log('[Playwright] 이웃 정보 추출 중...');
      const neighbors = await this.page.evaluate(() => {
        const items: NeighborBlogInfo[] = [];
        const neighborLinks = document.querySelectorAll('a[href*="/blog.naver.com/"]');

        neighborLinks.forEach((link) => {
          const href = link.getAttribute('href') || '';
          const blogId = href.split('/blog.naver.com/')[1]?.split('/')[0] || '';
          const nickname = link.textContent?.trim() || '';

          if (blogId && nickname && !items.some((n) => n.blogId === blogId)) {
            items.push({
              nickname,
              blogUrl: `https://blog.naver.com/${blogId}`,
              blogId,
            });
          }
        });

        return items;
      });

      console.log(`[Playwright] 총 ${neighbors.length}명의 이웃을 찾았습니다`);
      return neighbors;
    } catch (error) {
      console.error('[Playwright] 이웃 목록 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 최근 글 목록 가져오기 (지난 N일 이내)
   */
  async getRecentPosts(blogUrl: string, daysLimit: number = 7): Promise<BlogPostInfo[]> {
    try {
      console.log(`[Playwright] ${blogUrl}의 최근 글 조회 중... (${daysLimit}일 이내)`);

      await this.page.goto(blogUrl, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // 글 목록 로드 대기
      await this.page.waitForSelector('a[href*="/blog.naver.com/"] span', { timeout: 10000 }).catch(() => {});

      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - daysLimit);

      // 글 정보 추출
      const posts = await this.page.evaluate(() => {
        const items: BlogPostInfo[] = [];
        const postElements = document.querySelectorAll('li[data-article-id], .post-item, .post_item');

        postElements.forEach((element) => {
          const titleEl = element.querySelector('a[href*="/blog.naver.com/"]');
          const dateEl = element.querySelector('[datetime], .date, .post-date');

          if (titleEl) {
            const title = titleEl.textContent?.trim() || '';
            const url = titleEl.getAttribute('href') || '';
            const date = dateEl?.getAttribute('datetime') || dateEl?.textContent || '';

            // 날짜 검증 (간단한 필터링)
            if (title && url && url.includes('/blog.naver.com/')) {
              items.push({
                title,
                url,
                date,
                hasLike: false,
              });
            }
          }
        });

        return items;
      });

      console.log(`[Playwright] ${posts.length}개의 글을 찾았습니다`);
      return posts;
    } catch (error) {
      console.error('[Playwright] 글 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 글의 좋아요 상태 확인 및 누르기
   */
  async toggleLike(postUrl: string): Promise<boolean> {
    try {
      console.log(`[Playwright] 글 로드 중: ${postUrl}`);

      await this.page.goto(postUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // 좋아요 버튼 찾기 (여러 선택자 시도)
      const likeButton = await this.page
        .locator('button:has-text("좋아요"), .btn_like, [class*="like"]')
        .first()
        .elementHandle()
        .catch(() => null);

      if (!likeButton) {
        console.warn(`[Playwright] 좋아요 버튼을 찾을 수 없습니다: ${postUrl}`);
        return false;
      }

      // 좋아요 상태 확인
      const isLiked = await this.page.evaluate(() => {
        const btn = document.querySelector('button:has-text("좋아요"), .btn_like');
        return btn?.classList.contains('on') || btn?.getAttribute('aria-pressed') === 'true';
      });

      // 아직 좋아요가 안 눌려있으면 누르기
      if (!isLiked) {
        console.log(`[Playwright] 좋아요 누르기: ${postUrl}`);
        await this.page.locator('button:has-text("좋아요"), .btn_like').first().click();

        // 클릭 효과 대기
        await this.page.waitForTimeout(1000);

        console.log('[Playwright] ✅ 좋아요 완료');
        return true;
      } else {
        console.log('[Playwright] ℹ️ 이미 좋아요가 눌려있습니다');
        return false;
      }
    } catch (error) {
      console.error(`[Playwright] 좋아요 처리 오류 (${postUrl}):`, error);
      return false;
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    try {
      if (this.browser) {
        console.log('[Playwright] 브라우저 종료 중...');
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        console.log('[Playwright] 브라우저 종료 완료');
      }
    } catch (error) {
      console.error('[Playwright] 브라우저 종료 오류:', error);
    }
  }
}

/**
 * 이웃들의 최근 글에 자동으로 좋아요 누르기
 */
export async function processNeighborAutoLike(
  blogId: string,
  blogPassword: string,
  daysLimit: number = 7,
  maxNeighbors: number = 10
): Promise<AutoLikeResult> {
  const automation = new NaverBlogAutomation();
  const startTime = new Date();
  const result: AutoLikeResult = {
    success: true,
    totalProcessed: 0,
    totalLiked: 0,
    neighborStats: [],
    errors: [],
    startedAt: startTime.toISOString(),
    completedAt: new Date().toISOString(),
  };

  try {
    // 1. 로그인
    console.log('[Process] 로그인 시작...');
    await automation.login(blogId, blogPassword);

    // 2. 이웃 목록 가져오기
    console.log('[Process] 이웃 목록 조회...');
    const neighbors = await automation.getNeighbors(blogId);

    if (neighbors.length === 0) {
      result.errors.push('이웃이 없습니다');
      result.success = false;
      return result;
    }

    // 3. 각 이웃의 글에 좋아요 누르기
    const neighborsToProcess = neighbors.slice(0, maxNeighbors);
    console.log(`[Process] ${neighborsToProcess.length}명의 이웃 처리 시작...`);

    for (const neighbor of neighborsToProcess) {
      let postsLiked = 0;

      try {
        console.log(`\n[Process] 처리 중: ${neighbor.nickname} (${neighbor.blogId})`);

        // 최근 글 목록 조회
        const posts = await automation.getRecentPosts(neighbor.blogUrl, daysLimit);

        // 각 글에 좋아요 누르기
        for (const post of posts) {
          try {
            const liked = await automation.toggleLike(post.url);
            result.totalProcessed++;

            if (liked) {
              postsLiked++;
              result.totalLiked++;
              console.log(`✅ [${neighbor.nickname}] 좋아요: ${post.title}`);
            }

            // 너무 빠른 요청 방지 (1~2초 대기)
            await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
          } catch (error) {
            const errorMsg = `글 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
            console.error(errorMsg);
            result.errors.push(`${neighbor.nickname} - ${errorMsg}`);
          }
        }

        result.neighborStats.push({
          nickname: neighbor.nickname,
          postsProcessed: posts.length,
          postsLiked,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error(`[Process] ${neighbor.nickname} 처리 오류: ${errorMsg}`);
        result.errors.push(`${neighbor.nickname}: ${errorMsg}`);
      }
    }

    result.success = true;
    result.completedAt = new Date().toISOString();
    console.log(`\n[Process] 완료! 총 ${result.totalLiked}개의 좋아요 완료`);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[Process] 치명적 오류:', errorMsg);
    result.success = false;
    result.errors.push(`치명적 오류: ${errorMsg}`);
    result.completedAt = new Date().toISOString();
    return result;
  } finally {
    // 메모리에서 삭제
    console.log('[Process] 정리 중... (메모리 삭제)');
    await automation.close();
  }
}
