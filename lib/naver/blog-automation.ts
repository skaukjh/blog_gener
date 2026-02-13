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

      // 타임아웃 설정 (2차 인증 시간 고려)
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      // 로그인 페이지로 이동
      console.log('[Playwright] 네이버 로그인 페이지 이동 중...');
      await this.page.goto('https://nid.naver.com/nidlogin.login', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // ID 입력 (느린 입력으로 봇 탐지 회피)
      console.log('[Playwright] 아이디 입력 중...');
      const idInput = await this.page.locator('input[name="id"]').first();
      await idInput.fill(blogId, { delay: 100 });
      await this.page.waitForTimeout(500);

      // PW 입력
      console.log('[Playwright] 비밀번호 입력 중...');
      const pwInput = await this.page.locator('input[name="pw"]').first();
      await pwInput.fill(blogPassword, { delay: 100 });
      await this.page.waitForTimeout(500);

      // 로그인 버튼 클릭
      console.log('[Playwright] 로그인 버튼 클릭 중...');
      const loginButton = await this.page.locator('button:has-text("로그인")').first();
      await loginButton.click();

      // 2차 인증 대기 (최대 2분)
      console.log('[Playwright] 로그인 처리 중... (2차 인증 대기)');

      // 방법 1: 현재 페이지가 로그인 페이지에서 벗어날 때까지 대기
      let loginSuccess = false;
      let attempts = 0;
      const maxAttempts = 120; // 2분 (1초 * 120)

      while (!loginSuccess && attempts < maxAttempts) {
        try {
          const currentUrl = this.page.url();
          console.log(`[Playwright] 현재 URL: ${currentUrl}`);

          // 로그인 성공 확인:
          // 1. nid.naver.com을 벗어났거나
          // 2. blog.naver.com으로 리디렉션되었거나
          // 3. 메인 페이지로 이동
          if (
            !currentUrl.includes('nid.naver.com/nidlogin.login') ||
            currentUrl.includes('blog.naver.com') ||
            currentUrl.includes('naver.com') && !currentUrl.includes('nidlogin')
          ) {
            console.log('[Playwright] ✓ 로그인 페이지 벗어남 - 로그인 성공으로 판단');
            loginSuccess = true;
            break;
          }

          // 페이지 콘텐츠로도 확인
          const pageContent = await this.page.content();
          if (pageContent.includes('블로그') || pageContent.includes('내 정보')) {
            console.log('[Playwright] ✓ 페이지 콘텐츠로 로그인 확인');
            loginSuccess = true;
            break;
          }

          attempts++;
          await this.page.waitForTimeout(1000);
        } catch (err) {
          attempts++;
          await this.page.waitForTimeout(1000);
        }
      }

      if (!loginSuccess) {
        // 마지막 확인: 페이지가 로그인 페이지인지 확인
        const finalUrl = this.page.url();
        if (finalUrl.includes('nid.naver.com/nidlogin.login')) {
          throw new Error('로그인 실패: 아이디 또는 비밀번호가 올바르지 않습니다. 2차 인증을 완료하세요.');
        }
      }

      // 추가 로드 시간
      await this.page.waitForTimeout(2000);
      console.log('[Playwright] 로그인 성공');
      this.isLoggedIn = true;
    } catch (error) {
      console.error('[Playwright] 로그인 오류:', error);
      await this.close();
      throw error;
    }
  }

  /**
   * 페이지 구조 분석 (디버그용)
   */
  async debugPageStructure(): Promise<void> {
    try {
      console.log('[DEBUG] 페이지 HTML 구조 분석 중...');

      const structure = await this.page.evaluate(() => {
        // HTML 구조 로깅
        const bodyHTML = document.body.innerHTML.substring(0, 2000);
        console.log('[DEBUG] Body HTML (처음 2000자):');
        console.log(bodyHTML);

        // 모든 링크 수집
        const allLinks = Array.from(document.querySelectorAll('a'));
        console.log(`[DEBUG] 총 링크 개수: ${allLinks.length}`);

        // blog.naver.com 링크만 필터링
        const blogLinks = allLinks.filter((a) => a.href.includes('/blog.naver.com/'));
        console.log(`[DEBUG] blog.naver.com 링크 개수: ${blogLinks.length}`);

        // 각 링크의 텍스트와 href 출력
        blogLinks.slice(0, 10).forEach((link, idx) => {
          console.log(`[DEBUG] 링크 ${idx}: "${link.textContent?.trim()}" -> ${link.href}`);
        });

        // 가능한 이웃 관련 클래스/ID 찾기
        const potentialSelectors = [
          '.section_neighbor',
          '.neighbor_list',
          '.blog_item',
          '.post_item',
          '.cont_list',
          '[class*="neighbor"]',
          '[class*="blog"]',
          '[class*="item"]',
        ];

        console.log('[DEBUG] 가능한 선택자 검사:');
        potentialSelectors.forEach((selector) => {
          const count = document.querySelectorAll(selector).length;
          if (count > 0) {
            console.log(`[DEBUG] "${selector}": ${count}개 발견`);
          }
        });

        return {
          title: document.title,
          url: window.location.href,
          linkCount: allLinks.length,
          blogLinkCount: blogLinks.length,
        };
      });

      console.log('[DEBUG] 페이지 정보:', structure);
    } catch (error) {
      console.error('[DEBUG] 페이지 구조 분석 실패:', error);
    }
  }

  /**
   * 이웃 목록 가져오기 (관리자 페이지에서 - 동적 콘텐츠 대기)
   */
  async getNeighbors(blogId: string, maxCount: number = 20): Promise<NeighborBlogInfo[]> {
    try {
      if (!this.isLoggedIn) {
        throw new Error('로그인되지 않았습니다');
      }

      console.log(`[Playwright] 관리자 페이지에서 이웃 조회 중... (blogId: ${blogId})`);

      // 관리자 페이지의 이웃 목록 페이지로 이동
      const adminBuddyUrl = `https://admin.blog.naver.com/AdminMain.naver?blogId=${blogId}&Redirect=Buddyinfo`;
      console.log(`[Playwright] URL: ${adminBuddyUrl}`);

      await this.page.goto(adminBuddyUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // 동적 콘텐츠 로딩 대기 (최대 20초)
      console.log('[Playwright] 동적 콘텐츠 로딩 대기 중... (최대 20초)');
      let contentLoaded = false;

      for (let i = 0; i < 20; i++) {
        await this.page.waitForTimeout(1000);

        const elementInfo = await this.page.evaluate(() => {
          const buddyForm = document.querySelector('#buddyListManageForm');
          const buddyLinks = document.querySelectorAll('#buddyListManageForm a[href*="/blog.naver.com/"]');
          const allBlogLinks = document.querySelectorAll('a[href*="/blog.naver.com/"]');

          return {
            buddyFormFound: !!buddyForm,
            buddyLinksCount: buddyLinks.length,
            allBlogLinksCount: allBlogLinks.length,
          };
        });

        console.log(`[Playwright] 대기 ${i + 1}초: buddyForm=${elementInfo.buddyFormFound}, buddyLinks=${elementInfo.buddyLinksCount}, allLinks=${elementInfo.allBlogLinksCount}`);

        if (elementInfo.buddyFormFound && elementInfo.buddyLinksCount > 0) {
          console.log(`[Playwright] 콘텐츠 로딩 완료! (${elementInfo.buddyLinksCount}개 이웃 링크 발견)`);
          contentLoaded = true;
          break;
        }
      }

      if (!contentLoaded) {
        console.log('[Playwright] 경고: #buddyListManageForm을 찾지 못했습니다');
      }

      // 페이지의 전체 HTML 크기 확인
      const htmlSize = await this.page.evaluate(() => {
        return document.documentElement.outerHTML.length;
      });
      console.log(`[Playwright] 페이지 HTML 크기: ${htmlSize} bytes`);

      // 페이지 구조 분석
      console.log('[Playwright] 페이지 구조 분석 중...');
      await this.debugPageStructure();

      // 이웃 정보 추출 (iframe #papermain 내부에서 파싱)
      const allNeighborsWithDebug = await this.page.evaluate((maxCountParam: number) => {
        const items: any[] = [];
        const debug: any = {
          iframeFound: false,
          iframeDocFound: false,
          formFound: false,
          tableFound: false,
          forms: [],
          tables: [],
          selectedTable: null,
        };

        // iframe #papermain 찾기
        const iframe = document.querySelector('#papermain') as HTMLIFrameElement;
        debug.iframeFound = !!iframe;

        if (!iframe) {
          return { items: [], debug };
        }

        // iframe 내부 document 접근
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        debug.iframeDocFound = !!iframeDoc;

        if (!iframeDoc) {
          return { items: [], debug };
        }

        // iframe 내부에서 모든 form 확인
        const forms = iframeDoc.querySelectorAll('form');
        debug.forms = Array.from(forms).map((f) => ({
          id: f.id,
          name: f.name,
          className: f.className,
        }));

        // iframe 내부에서 모든 table 확인
        const tables = iframeDoc.querySelectorAll('table');
        debug.tables = Array.from(tables).map((t, idx) => ({
          idx,
          id: t.id,
          className: t.className,
          rows: t.querySelectorAll('tr').length,
        }));

        // iframe 내부에서 정확한 선택자: #buddyListManageForm > table
        const buddyForm = iframeDoc.querySelector('#buddyListManageForm');
        debug.formFound = !!buddyForm;

        if (buddyForm) {
          const buddyTable = buddyForm.querySelector('table');
          debug.tableFound = !!buddyTable;

          if (buddyTable) {
            debug.selectedTable = {
              id: buddyTable.id,
              className: buddyTable.className,
              rows: buddyTable.querySelectorAll('tr').length,
            };

            // 테이블의 모든 행 순회
            const rows = buddyTable.querySelectorAll('tbody tr');

            rows.forEach((row) => {
              // 각 행에서 이웃명 링크 찾기
              const cells = row.querySelectorAll('td');

              // 정확한 경로: td.buddy > div > a
              let found = false;
              for (let i = 0; i < cells.length; i++) {
                const buddyCell = cells[i];
                if (buddyCell.classList.contains('buddy')) {
                  const link = buddyCell.querySelector('div > a') as HTMLAnchorElement;

                  if (link && !found) {
                    const url = link.href || '';
                    const nickname = link.textContent?.trim() || '';

                    const blogIdMatch = url.match(/\/blog\.naver\.com\/([a-zA-Z0-9_]+)/);
                    const blogId = blogIdMatch ? blogIdMatch[1] : '';

                    if (blogId && nickname && !items.some((i) => i.blogId === blogId)) {
                      items.push({
                        nickname: nickname.substring(0, 50),
                        blogUrl: `https://blog.naver.com/${blogId}`,
                        blogId,
                      });

                      found = true;
                    }
                  }
                  break;
                }
              }
            });
          }
        }

        return { items: items.slice(0, maxCountParam), debug };
      }, maxCount);

      // 디버그 정보 출력
      console.log('[Playwright] 이웃 파싱 결과:');
      console.log('[Playwright] - iframe #papermain 찾음:', allNeighborsWithDebug.debug.iframeFound);
      console.log('[Playwright] - iframe document 접근 성공:', allNeighborsWithDebug.debug.iframeDocFound);
      console.log('[Playwright] - Form 찾음:', allNeighborsWithDebug.debug.formFound);
      console.log('[Playwright] - Table 찾음:', allNeighborsWithDebug.debug.tableFound);
      console.log('[Playwright] - Forms:', JSON.stringify(allNeighborsWithDebug.debug.forms, null, 2));
      console.log('[Playwright] - Tables:', JSON.stringify(allNeighborsWithDebug.debug.tables, null, 2));
      console.log('[Playwright] - Selected Table:', JSON.stringify(allNeighborsWithDebug.debug.selectedTable, null, 2));

      const allNeighbors = allNeighborsWithDebug.items;

      console.log(`[Playwright] 총 ${allNeighbors.length}명의 이웃을 찾았습니다`);

      // 이웃이 없으면 오류
      if (allNeighbors.length === 0) {
        throw new Error(
          '이웃을 찾을 수 없습니다. 먼저 이웃을 추가하고 다시 시도하세요.'
        );
      }

      return allNeighbors;
    } catch (error) {
      console.error('[Playwright] 이웃 목록 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 블로그 페이지 구조 분석 (글 목록)
   */
  async debugBlogPageStructure(): Promise<void> {
    try {
      const pageInfo = await this.page.evaluate(() => {
        const info: any = {
          allLinks: 0,
          articleLinks: 0,
          titleElements: 0,
          dateElements: 0,
          liElements: 0,
          divElements: 0,
          articleElements: 0,
          bodyLength: 0,
          htmlSnippet: '',
          titleLinkPatterns: [],
        };

        // 모든 링크 계산
        info.allLinks = document.querySelectorAll('a').length;

        // body 크기
        info.bodyLength = document.body?.innerHTML?.length || 0;

        // HTML 스니펫 (처음 2000자)
        info.htmlSnippet = document.body?.innerHTML?.substring(0, 2000) || '';

        // article 관련 요소 찾기
        info.articleElements = document.querySelectorAll('[class*="article"], [class*="post"], article').length;

        // 날짜 관련 요소
        info.dateElements = document.querySelectorAll('[datetime], .date, .date_text, .post-date, [class*="date"]').length;

        // li 요소
        info.liElements = document.querySelectorAll('li').length;

        // div 요소 (전체)
        info.divElements = document.querySelectorAll('div').length;

        // 제목 링크 패턴 분석
        const titleLinks = document.querySelectorAll(
          'a[class*="title"], a[class*="post"], a[class*="article"], .se-link, a[class*="entry"]'
        );
        info.titleElements = titleLinks.length;

        // 샘플 링크 수집
        titleLinks.forEach((link: any, idx: number) => {
          if (idx < 5) {
            info.titleLinkPatterns.push({
              text: link.textContent?.trim().substring(0, 30),
              href: link.href?.substring(0, 80),
              className: link.className,
              parent: link.parentElement?.className,
            });
          }
        });

        // 모든 a 태그 수집 (최대 10개)
        info.allAnchorTags = [];
        document.querySelectorAll('a').forEach((link: any, idx: number) => {
          if (idx < 10) {
            info.allAnchorTags.push({
              text: link.textContent?.trim().substring(0, 20),
              href: link.href?.substring(0, 60),
              className: link.className,
            });
          }
        });

        return info;
      });

      console.log('[DEBUG] 블로그 페이지 구조:');
      console.log(JSON.stringify(pageInfo, null, 2));
    } catch (error) {
      console.error('[DEBUG] 블로그 페이지 분석 실패:', error);
    }
  }

  /**
   * 최근 글 목록 가져오기 (지난 N일 이내)
   */
  async getRecentPosts(blogUrl: string, daysLimit: number = 7): Promise<BlogPostInfo[]> {
    try {
      console.log(`[Playwright] ${blogUrl}의 최근 글 조회 중... (${daysLimit}일 이내)`);

      // 블로그 ID 추출
      const blogIdMatch = blogUrl.match(/\/blog\.naver\.com\/([a-zA-Z0-9_]+)/);
      if (!blogIdMatch) {
        console.warn('[Playwright] 블로그 ID를 추출할 수 없습니다');
        return [];
      }

      const blogId = blogIdMatch[1];
      console.log(`[Playwright] 블로그 ID: ${blogId}`);

      // PrologueList 페이지로 이동 (실제 글 목록)
      const prologueUrl = `https://blog.naver.com/prologue/PrologueList.naver?blogId=${blogId}&noTrackingCode=true&directAccess=true`;
      console.log(`[Playwright] 글 목록 페이지: ${prologueUrl}`);

      await this.page.goto(prologueUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      // 페이지 로드 및 동적 콘텐츠 로딩 대기
      console.log('[Playwright] 페이지 로드 대기 중...');
      await this.page.waitForTimeout(3000);

      // 디버그: 페이지 구조 분석
      await this.debugBlogPageStructure();

      // 글 정보 추출
      const posts = await this.page.evaluate(() => {
        const items: BlogPostInfo[] = [];

        // 모든 링크를 검사하여 블로그 글 찾기
        const allLinks = document.querySelectorAll('a');
        const postMap = new Map<string, BlogPostInfo>();

        console.log(`[evaluate] 전체 링크 개수: ${allLinks.length}`);

        allLinks.forEach((link) => {
          const url = link.href || '';
          const title = link.textContent?.trim() || '';

          // 블로그 글 URL 패턴 확인
          // 패턴 1: /blog.naver.com/blogid/123456789
          // 패턴 2: /PostView.naver?
          // 패턴 3: /entry.naver?
          const isPostUrl = url.match(/\/blog\.naver\.com\/[a-zA-Z0-9_]+\/\d+/) ||
                           url.match(/\/PostView\.naver\?/) ||
                           url.match(/\/entry\.naver\?/);

          if (isPostUrl && title && title.length > 0 && !postMap.has(url)) {
            postMap.set(url, {
              title,
              url,
              date: '',
              hasLike: false,
            });
          }
        });

        postMap.forEach((item) => {
          items.push(item);
        });

        console.log(`[evaluate] 발견된 글: ${items.length}개`);
        return items;
      });

      console.log(`[Playwright] ${posts.length}개의 글을 찾았습니다`);
      return posts.slice(0, 30);
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

      // URL에서 logNo 추출 (좋아요 버튼 ID 생성용)
      const logNoMatch = postUrl.match(/logNo=(\d+)/);
      const logNo = logNoMatch ? logNoMatch[1] : null;
      console.log(`[Playwright] logNo 추출: ${logNo}`);

      await this.page.goto(postUrl, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });

      // 광고 배너 제거 (페이지 이동 방지)
      console.log('[Playwright] 광고 배너 제거 중...');
      await this.page.evaluate(() => {
        // iframe 광고 제거
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          const src = iframe.getAttribute('src') || '';
          if (src.includes('ad') || src.includes('adv') || src.includes('double')) {
            try {
              iframe.style.display = 'none';
              iframe.remove();
            } catch (e) {
              // 제거 실패 무시
            }
          }
        });

        // 광고 클래스/ID 제거
        const adElements = document.querySelectorAll('[class*="adv"], [id*="adv"]');
        adElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.tagName !== 'BODY' && htmlEl.tagName !== 'HTML') {
            try {
              htmlEl.style.display = 'none';
              htmlEl.remove();
            } catch (e) {
              // 제거 실패 무시
            }
          }
        });

        console.log('[evaluate] 광고 배너 제거 완료');
      });

      // 페이지 로드 대기
      await this.page.waitForTimeout(2000);

      // #printPost1 영역까지 스크롤 내리기 (좋아요 버튼 노출)
      console.log('[Playwright] 글 영역까지 스크롤 중...');
      await this.page.evaluate(() => {
        const printPost = document.querySelector('#printPost1');
        if (printPost) {
          printPost.scrollIntoView({ behavior: 'smooth', block: 'end' });
          console.log('[evaluate] #printPost1까지 스크롤 완료');
        } else {
          console.log('[evaluate] #printPost1을 찾지 못함, 전체 스크롤');
          window.scrollBy(0, document.body.scrollHeight);
        }
      });

      // 스크롤 완료 대기
      await this.page.waitForTimeout(1500);

      // 페이지 HTML 크기 확인
      const htmlSize = await this.page.evaluate(() => {
        return document.documentElement.outerHTML.length;
      });
      console.log(`[Playwright] PostView 페이지 HTML 크기: ${htmlSize} bytes`);

      // 좋아요 버튼 찾기 및 상태 확인 (정확한 선택자 사용)
      const likeInfo = await this.page.evaluate((logNoParam: string | null) => {
        console.log(`[evaluate] 좋아요 버튼 검색 (logNo: ${logNoParam})...`);

        let likeButton: HTMLElement | null = null;

        // 전략 1: logNo를 사용한 정확한 선택자
        if (logNoParam) {
          const selector = `#area_sympathy${logNoParam}`;
          const sympathyArea = document.querySelector(selector);
          console.log(`[evaluate] ${selector} 검색: ${sympathyArea ? '찾음' : '미발견'}`);

          if (sympathyArea) {
            // #area_sympathy{logNo} > div > div > div > a > span.u_likeit_icons > span
            const likeLink = sympathyArea.querySelector('div > div > div > a');
            if (likeLink) {
              likeButton = likeLink as HTMLElement;
              console.log(`[evaluate] 정확한 선택자로 좋아요 버튼 발견`);
            }
          }
        }

        // 전략 2: #printPost1 내의 좋아요 버튼 찾기
        if (!likeButton) {
          console.log('[evaluate] #printPost1 내 좋아요 버튼 검색...');
          const printPost = document.querySelector('#printPost1');
          if (printPost) {
            const likeArea = printPost.querySelector('td.bcc');
            if (likeArea) {
              // span.u_likeit_icons 검색
              const likeIcon = likeArea.querySelector('span.u_likeit_icons');
              if (likeIcon && likeIcon.parentElement) {
                likeButton = likeIcon.parentElement as HTMLElement;
                console.log('[evaluate] #printPost1 > td.bcc에서 좋아요 버튼 발견');
              }
            }
          }
        }

        // 전략 3: span.u_likeit_icons 직접 검색
        if (!likeButton) {
          console.log('[evaluate] span.u_likeit_icons 직접 검색...');
          const allLikeSpans = document.querySelectorAll('span.u_likeit_icons');
          console.log(`[evaluate] span.u_likeit_icons 개수: ${allLikeSpans.length}`);
          if (allLikeSpans.length > 0) {
            const firstLikeSpan = allLikeSpans[0];
            if (firstLikeSpan.parentElement) {
              likeButton = firstLikeSpan.parentElement as HTMLElement;
              console.log('[evaluate] span.u_likeit_icons의 부모 요소 사용');
            }
          }
        }

        // 전략 4: "좋아요" 텍스트 검색 (폴백)
        if (!likeButton) {
          console.log('[evaluate] "좋아요" 텍스트 검색 (폴백)...');
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const htmlEl = el as HTMLElement;
            const text = htmlEl.textContent?.trim() || '';
            if (text === '좋아요' && (htmlEl.tagName === 'A' || htmlEl.tagName === 'SPAN')) {
              likeButton = htmlEl.tagName === 'A' ? htmlEl : htmlEl.parentElement;
              console.log('[evaluate] "좋아요" 텍스트로 버튼 발견');
              break;
            }
          }
        }

        if (!likeButton) {
          return { found: false, isLiked: false };
        }

        // 좋아요 상태 확인
        const isLiked = likeButton.classList.contains('on') ||
                       likeButton.getAttribute('aria-pressed') === 'true' ||
                       likeButton.classList.contains('active') ||
                       likeButton.classList.contains('is_like');

        console.log(`[evaluate] 좋아요 버튼 발견, 상태: ${isLiked ? '눌림' : '안 눌림'}`);

        return { found: true, isLiked };
      }, logNo);

      if (!likeInfo.found) {
        console.warn(`[Playwright] 좋아요 버튼을 찾을 수 없습니다: ${postUrl}`);
        return false;
      }

      // 아직 좋아요가 안 눌려있으면 누르기
      if (!likeInfo.isLiked) {
        console.log(`[Playwright] 좋아요 누르기: ${postUrl}`);

        // 좋아요 버튼 클릭 (정확한 선택자 사용)
        const clickSuccess = await this.page.evaluate((logNoParam: string | null) => {
          let likeElement: HTMLElement | null = null;

          // 전략 1: logNo를 사용한 정확한 선택자
          if (logNoParam) {
            const selector = `#area_sympathy${logNoParam}`;
            const sympathyArea = document.querySelector(selector);
            if (sympathyArea) {
              const likeLink = sympathyArea.querySelector('div > div > div > a');
              if (likeLink) {
                likeElement = likeLink as HTMLElement;
                console.log(`[evaluate] 정확한 선택자로 클릭 버튼 발견`);
              }
            }
          }

          // 전략 2: #printPost1 내의 좋아요 버튼
          if (!likeElement) {
            const printPost = document.querySelector('#printPost1');
            if (printPost) {
              const likeArea = printPost.querySelector('td.bcc');
              if (likeArea) {
                const likeIcon = likeArea.querySelector('span.u_likeit_icons');
                if (likeIcon && likeIcon.parentElement) {
                  likeElement = likeIcon.parentElement as HTMLElement;
                  console.log('[evaluate] #printPost1에서 클릭 버튼 발견');
                }
              }
            }
          }

          // 전략 3: span.u_likeit_icons 직접 사용
          if (!likeElement) {
            const likeSpan = document.querySelector('span.u_likeit_icons');
            if (likeSpan && likeSpan.parentElement) {
              likeElement = likeSpan.parentElement as HTMLElement;
              console.log('[evaluate] span.u_likeit_icons로 클릭 버튼 발견');
            }
          }

          if (!likeElement) {
            console.log('[evaluate] 좋아요 버튼을 찾지 못함');
            return false;
          }

          try {
            likeElement.click();
            console.log('[evaluate] 좋아요 클릭 완료');
            return true;
          } catch (e) {
            console.log('[evaluate] 클릭 실패:', (e as Error).message);
            return false;
          }
        }, logNo);

        if (!clickSuccess) {
          console.warn('[Playwright] 좋아요 버튼 클릭에 실패했습니다');
          return false;
        }

        // 클릭 효과 대기
        await this.page.waitForTimeout(2000);

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
