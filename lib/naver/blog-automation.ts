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
  logNo?: string; // 글 번호
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

export interface NeighborPostLikeResult {
  success: boolean;
  totalPages: number;
  totalProcessed: number;
  totalLiked: number;
  totalFailed: number;
  startedAt: string;
  completedAt: string;
  details: Array<{
    page: number;
    title: string;
    liked: boolean;
    reason?: string; // 실패 이유 또는 이미 눌러짐 등
  }>;
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

      // 기준 날짜 계산 (지난 N일 이내)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
      console.log(`[Playwright] 날짜 필터: ${cutoffDate.toLocaleDateString('ko-KR')} 이후`);

      // 글 정보 추출 (실제 글 URL 추출 우선)
      const posts = await this.page.evaluate(() => {
        const items: BlogPostInfo[] = [];

        // 방법 1: 테이블 기반 글 목록 (PrologueList 페이지)
        const postRows = document.querySelectorAll('table tr');
        console.log(`[evaluate] 테이블 행: ${postRows.length}`);

        postRows.forEach((row) => {
          const titleCell = row.querySelector('td:first-child a, a[class*="title"]') as HTMLAnchorElement;
          const dateCell = row.querySelector('td:last-child, [class*="date"]');

          if (titleCell) {
            let url = titleCell.href || '';
            const title = titleCell.textContent?.trim() || '';
            const date = dateCell?.textContent?.trim() || '';

            // 상대 경로 처리
            if (url && !url.startsWith('http')) {
              url = 'https://blog.naver.com' + url;
            }

            // 실제 글 URL인지 확인
            const logNoMatch = url.match(/logNo=(\d+)|\/(\d+)$/);
            if (title && logNoMatch) {
              items.push({
                title,
                url,
                date,
                hasLike: false,
              });
            }
          }
        });

        // 방법 2: logNo 기반 링크 검사 (PostView 패턴)
        if (items.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="logNo"], a[href*="/blog.naver.com"]');
          const postMap = new Map<string, BlogPostInfo>();

          console.log(`[evaluate] logNo 기반 링크 검사: ${allLinks.length}개`);

          allLinks.forEach((link) => {
            const anchor = link as HTMLAnchorElement;
            const url = anchor.href || '';
            const title = link.textContent?.trim() || '';

            // logNo가 있는 URL만 선택
            const hasLogNo = /logNo=\d+|\/\d{9,}/.test(url);
            const isValidUrl = /blog\.naver\.com|PostView/.test(url);

            if (hasLogNo && isValidUrl && title && title.length > 2 && !postMap.has(url)) {
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
        }

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
   * 글의 게시 날짜 확인
   */
  async getPostDate(postUrl: string): Promise<Date | null> {
    try {
      console.log(`[Playwright] 글 날짜 확인 중: ${postUrl}`);

      await this.page.goto(postUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      // 페이지 로드 대기
      await this.page.waitForTimeout(1000);

      // 날짜 파싱 (iframe 내부에서 실행)
      const dateString = await this.page.evaluate(() => {
        // iframe 찾기
        const iframe = document.querySelector('iframe');
        const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;

        if (!iframeDoc) {
          console.log('[evaluate] iframe을 찾을 수 없습니다');
          return '';
        }

        console.log('[evaluate] 날짜 파싱 시작...');

        // 방법 1: 사용자가 제시한 선택자
        let dateElement = iframeDoc.querySelector(
          '#SE-BC25FC5F-FE4A-47E4-9CD5-18A13F09A130 > div > div > div.blog2_container > span > span.desc > span'
        );

        if (dateElement) {
          const text = dateElement.textContent?.trim() || '';
          if (text) {
            console.log('[evaluate] 선택자 1에서 발견:', text);
            return text;
          }
        }

        // 방법 2: 다른 선택자들 시도
        const alternateSelectors = [
          '.se_publishDate',
          '.gm-ucc-date',
          '[data-date]',
          '[datetime]',
          '.se-text-author-date',
          'span.desc > span',
          '.se_profile span',
          '[class*="date"] [class*="desc"]',
        ];

        for (const selector of alternateSelectors) {
          const el = iframeDoc.querySelector(selector);
          if (el) {
            const dateText = el.getAttribute('datetime') || el.textContent?.trim() || '';
            if (dateText && /\d{4}/.test(dateText)) {
              console.log('[evaluate] 선택자 대체에서 발견:', dateText);
              return dateText;
            }
          }
        }

        // 방법 3: 모든 span에서 정확한 날짜 패턴 찾기 (우선순위: 가장 작은 텍스트)
        const allSpans = Array.from(iframeDoc.querySelectorAll('span'));

        // 날짜 패턴 정규식
        const datePatterns = [
          /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./,  // "2024. 2. 2."
          /^\d{4}\.\d{1,2}\.\d{1,2}\./,        // "2024.2.2."
          /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./,   // 중간에 있는 날짜
        ];

        for (const pattern of datePatterns) {
          const dateSpan = allSpans.find(span => {
            const text = span.textContent?.trim() || '';
            return pattern.test(text) && text.length < 50; // 날짜만 있거나 최소한의 텍스트
          });

          if (dateSpan) {
            const text = dateSpan.textContent?.trim() || '';
            console.log('[evaluate] span 검색에서 발견:', text);
            return text;
          }
        }

        // 방법 4: 프로파일 영역에서 찾기 (보통 "시간 · YYYY.M.D. 시간" 형식)
        const profileElements = iframeDoc.querySelectorAll('[class*="profile"], [class*="author"], [class*="info"]');
        for (const el of profileElements) {
          const text = el.textContent || '';
          const match = text.match(/\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./);
          if (match) {
            console.log('[evaluate] 프로파일 영역에서 발견:', match[0]);
            return match[0];
          }
        }

        console.log('[evaluate] 날짜를 찾을 수 없습니다. HTML 스니펫 (처음 2000자):');
        console.log(iframeDoc.body.innerHTML.substring(0, 2000));

        return '';
      });

      if (!dateString) {
        console.warn('[Playwright] 날짜를 파싱할 수 없습니다');
        console.warn('[Playwright] 이 글을 처리하지 않습니다 (날짜 미확인)');
        return null;
      }

      console.log(`[Playwright] 파싱된 날짜 문자열: ${dateString}`);

      // 날짜 문자열 파싱 (예: "2024.2.14.", "2024. 2. 14.", "오늘", "어제" 등)
      let date: Date | null = null;

      // 패턴 1: "YYYY.M.D." 형식
      const dotMatch = dateString.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
      if (dotMatch) {
        date = new Date(parseInt(dotMatch[1]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[3]));
      }
      // 패턴 2: "YYYY-MM-DD" 형식
      else if (dateString.match(/\d{4}-\d{2}-\d{2}/)) {
        date = new Date(dateString.split('T')[0]);
      }
      // 패턴 3: "오늘" (today)
      else if (dateString.includes('오늘')) {
        date = new Date();
      }
      // 패턴 4: "어제" (yesterday)
      else if (dateString.includes('어제')) {
        date = new Date();
        date.setDate(date.getDate() - 1);
      }
      // 패턴 5: "N일 전" 형식
      else {
        const daysAgoMatch = dateString.match(/(\d+)\s*일\s*전/);
        if (daysAgoMatch) {
          date = new Date();
          date.setDate(date.getDate() - parseInt(daysAgoMatch[1]));
        }
      }

      if (date) {
        console.log(`[Playwright] 파싱된 날짜: ${date.toLocaleDateString('ko-KR')}`);
        return date;
      }

      console.warn('[Playwright] 날짜 형식을 인식할 수 없습니다:', dateString);
      return null;
    } catch (error) {
      console.error('[Playwright] 날짜 확인 오류:', error);
      return null;
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

      // 좋아요 버튼 찾기 및 상태 확인 (정확한 선택자 사용, iframe 처리)
      const likeInfo = await this.page.evaluate((logNoParam: string | null) => {
        console.log(`[evaluate] 좋아요 버튼 검색 (logNo: ${logNoParam})...`);

        // iframe 찾기
        const iframe = document.querySelector('iframe');
        const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;

        if (!iframeDoc) {
          console.log('[evaluate] iframe을 찾을 수 없습니다');
          return { found: false, isLiked: false };
        }

        let likeButton: HTMLElement | null = null;
        let debugInfo = {
          strategies: [] as string[],
          ariaPressed: '',
          classList: [] as string[],
        };

        // 전략 1: 사용자가 제시한 정확한 선택자 (logNo 기반)
        if (logNoParam) {
          const selector = `#area_sympathy${logNoParam} > a`;
          console.log(`[evaluate] 선택자 1 (iframe 내): ${selector}`);
          const element = iframeDoc.querySelector(selector);
          if (element) {
            likeButton = element as HTMLElement;
            debugInfo.strategies.push(`정확한 선택자 발견: ${selector}`);
            console.log(`[evaluate] ✓ 정확한 선택자로 좋아요 버튼 발견`);
          }
        }

        // 전략 2: #area_sympathy{logNo} 범위 내에서 a 태그 찾기
        if (!likeButton && logNoParam) {
          const selector = `#area_sympathy${logNoParam} a`;
          console.log(`[evaluate] 선택자 2 (iframe 내): ${selector}`);
          const sympathyArea = iframeDoc.querySelector(selector);
          if (sympathyArea) {
            likeButton = sympathyArea as HTMLElement;
            debugInfo.strategies.push(`area_sympathy 범위 내 a 태그`);
            console.log(`[evaluate] ✓ #area_sympathy 범위 내 a 태그 발견`);
          }
        }

        // 전략 3: "공감" 텍스트로 검색 (iframe 내부)
        if (!likeButton) {
          console.log('[evaluate] 선택자 3: "공감" 텍스트 검색');
          const allLinks = iframeDoc.querySelectorAll('a, button');
          for (const link of allLinks) {
            const text = link.textContent?.trim() || '';
            if (text.includes('공감')) {
              likeButton = link as HTMLElement;
              debugInfo.strategies.push(`"공감" 텍스트로 검색`);
              console.log(`[evaluate] ✓ "공감" 텍스트로 버튼 발견`);
              break;
            }
          }
        }

        if (!likeButton) {
          console.log('[evaluate] ✗ 좋아요 버튼을 찾을 수 없습니다');
          return { found: false, isLiked: false, debug: debugInfo };
        }

        // 좋아요 상태 확인 (aria-pressed 속성 우선)
        const ariaPressedValue = likeButton.getAttribute('aria-pressed');
        debugInfo.ariaPressed = ariaPressedValue || '없음';
        debugInfo.classList = Array.from(likeButton.classList);

        console.log(`[evaluate] aria-pressed: ${ariaPressedValue}`);
        console.log(`[evaluate] class: ${likeButton.className}`);

        // aria-pressed 속성 확인 (문자열 'true' 확인)
        const isLikedByAriaPressed = ariaPressedValue === 'true';

        // 클래스로도 확인 (폴백) - 'off' 클래스 확인
        const isLikedByClass = !likeButton.classList.contains('off') &&
                               !likeButton.className.includes('_face off');

        const isLiked = isLikedByAriaPressed || isLikedByClass;

        console.log(`[evaluate] 좋아요 상태: ${isLiked ? '눌림 (Y)' : '안 눌림 (N)'}`);

        return { found: true, isLiked, debug: debugInfo };
      }, logNo);

      if (!likeInfo.found) {
        console.warn(`[Playwright] 좋아요 버튼을 찾을 수 없습니다: ${postUrl}`);
        return false;
      }

      // 아직 좋아요가 안 눌려있으면 누르기
      if (!likeInfo.isLiked) {
        console.log(`[Playwright] 좋아요 누르기: ${postUrl}`);

        // 좋아요 버튼 클릭 (정확한 선택자 사용, iframe 처리)
        const clickSuccess = await this.page.evaluate((logNoParam: string | null) => {
          console.log('[evaluate] 좋아요 버튼 클릭 시작...');

          // iframe 찾기
          const iframe = document.querySelector('iframe');
          const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;

          if (!iframeDoc) {
            console.log('[evaluate] iframe을 찾을 수 없습니다');
            return false;
          }

          let likeElement: HTMLElement | null = null;

          // 전략 1: 사용자가 제시한 정확한 선택자
          if (logNoParam) {
            const selector = `#area_sympathy${logNoParam} > a`;
            console.log(`[evaluate] 선택자 1 (iframe 내): ${selector}`);
            const element = iframeDoc.querySelector(selector);
            if (element) {
              likeElement = element as HTMLElement;
              console.log(`[evaluate] ✓ 정확한 선택자로 클릭 버튼 발견`);
            }
          }

          // 전략 2: #area_sympathy{logNo} 범위 내에서 a 태그 찾기
          if (!likeElement && logNoParam) {
            const selector = `#area_sympathy${logNoParam} a`;
            console.log(`[evaluate] 선택자 2 (iframe 내): ${selector}`);
            const element = iframeDoc.querySelector(selector);
            if (element) {
              likeElement = element as HTMLElement;
              console.log(`[evaluate] ✓ #area_sympathy 범위 내 a 태그로 클릭 버튼 발견`);
            }
          }

          // 전략 3: "공감" 텍스트로 검색
          if (!likeElement) {
            console.log('[evaluate] 선택자 3: "공감" 텍스트 검색');
            const allLinks = iframeDoc.querySelectorAll('a, button');
            for (const link of allLinks) {
              const text = link.textContent?.trim() || '';
              if (text.includes('공감')) {
                likeElement = link as HTMLElement;
                console.log(`[evaluate] ✓ "공감" 텍스트로 클릭 버튼 발견`);
                break;
              }
            }
          }

          if (!likeElement) {
            console.log('[evaluate] ✗ 클릭할 좋아요 버튼을 찾을 수 없음');
            return false;
          }

          try {
            // 버튼 정보 로깅
            console.log('[evaluate] 클릭 전 상태:');
            console.log('  - aria-pressed:', likeElement.getAttribute('aria-pressed'));
            console.log('  - class:', likeElement.className);

            // iframe 내에서는 scrollIntoView를 사용할 수 있음
            likeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log('[evaluate] 버튼 스크롤 완료');

            // 클릭 실행
            likeElement.click();
            console.log('[evaluate] ✓ 좋아요 클릭 완료');
            return true;
          } catch (e) {
            console.log('[evaluate] ✗ 클릭 실패:', (e as Error).message);
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
   * 네이버 블로그 홈의 이웃새글에 일괄 좋아요 누르기 (페이지 순회 포함)
   * - 현재 페이지의 이웃새글 모두 처리
   * - 다음 페이지 있으면 자동 이동
   * - 글 제목과 성공/실패 이유 기록
   */
  async autoLikeNeighborPosts(): Promise<NeighborPostLikeResult> {
    const startTime = new Date();
    const result: NeighborPostLikeResult = {
      success: true,
      totalPages: 0,
      totalProcessed: 0,
      totalLiked: 0,
      totalFailed: 0,
      startedAt: startTime.toISOString(),
      completedAt: new Date().toISOString(),
      details: [],
    };

    try {
      console.log('[Playwright] 이웃새글 자동 좋아요 시작 (페이지 순회)...');

      if (!this.isLoggedIn) {
        throw new Error('로그인되지 않았습니다');
      }

      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        console.log(`\n[Playwright] ===== 페이지 ${currentPage} 처리 중 =====`);
        result.totalPages = currentPage;

        // 이웃새글 섹션의 좋아요 버튼과 글 정보 찾기
        const pageResults = await this.page.evaluate(() => {
          const items: Array<{ title: string; ariaPressed: string | null; element: any }> = [];

          // 이웃새글 섹션 찾기
          const h3 = Array.from(document.querySelectorAll('h3')).find((h) =>
            h.textContent?.includes('이웃새글')
          );
          if (!h3) {
            return { items: [], hasNextButton: false };
          }

          let container = h3.parentElement;
          while (container && !(container as HTMLElement).querySelector('[class*="list"]')) {
            container = container.parentElement;
          }

          if (!container) {
            return { items: [], hasNextButton: false };
          }

          // 각 글과 좋아요 버튼 찾기
          const likeButtons = (container as HTMLElement).querySelectorAll('a.u_likeit_button._face');

          likeButtons.forEach((btn, idx) => {
            // 글 제목 찾기 (버튼의 상위 요소에서)
            let titleElement = (btn as HTMLElement).closest('[class*="info"]')?.querySelector('strong');
            const title = titleElement?.textContent?.trim() || `[제목 없음 #${idx + 1}]`;

            items.push({
              title,
              ariaPressed: btn.getAttribute('aria-pressed'),
              element: btn, // 나중에 click() 호출 용도
            });
          });

          // "다음" 버튼 활성 상태 확인
          const nextButton = Array.from(document.querySelectorAll('a')).find((a) =>
            a.textContent?.trim() === '다음'
          ) as HTMLElement | undefined;
          const hasNextButton =
            !!nextButton &&
            nextButton.getAttribute('aria-disabled') !== 'true' &&
            !nextButton.classList.contains('disabled');

          return { items, hasNextButton };
        });

        const pageItems = pageResults.items;
        console.log(`[Playwright] 페이지 ${currentPage}: ${pageItems.length}개 글 발견`);

        // 각 글의 좋아요 처리
        for (let i = 0; i < pageItems.length; i++) {
          const item = pageItems[i];
          const displayIndex = `[${currentPage}-${i + 1}]`;

          try {
            const likeButtons = await this.page.locator('a.u_likeit_button._face').all();
            if (i >= likeButtons.length) {
              console.warn(`${displayIndex} 버튼 인덱스 초과`);
              continue;
            }

            const btn = likeButtons[i];
            const ariaPressed = await btn.getAttribute('aria-pressed');

            result.totalProcessed++;

            if (ariaPressed === 'true') {
              result.details.push({
                page: currentPage,
                title: item.title,
                liked: false,
                reason: '이미 좋아요됨',
              });
              console.log(`${displayIndex} ⏭️  ${item.title} (이미 눌러짐)`);
            } else {
              try {
                await btn.click();
                result.totalLiked++;
                result.details.push({
                  page: currentPage,
                  title: item.title,
                  liked: true,
                });
                console.log(`${displayIndex} ✅ ${item.title}`);

                // 서버 응답 대기
                await this.page.waitForTimeout(300);
              } catch (clickErr) {
                result.totalFailed++;
                const errorMsg = clickErr instanceof Error ? clickErr.message : '알 수 없는 오류';
                result.details.push({
                  page: currentPage,
                  title: item.title,
                  liked: false,
                  reason: errorMsg,
                });
                console.warn(`${displayIndex} ❌ ${item.title} (실패: ${errorMsg})`);
              }
            }
          } catch (err) {
            result.totalFailed++;
            result.totalProcessed++;
            const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
            result.details.push({
              page: currentPage,
              title: item.title,
              liked: false,
              reason: errorMsg,
            });
            console.error(`${displayIndex} ❌ 오류: ${errorMsg}`);
          }
        }

        // 다음 페이지 이동
        if (pageResults.hasNextButton) {
          console.log(`[Playwright] 다음 페이지로 이동 중...`);

          try {
            // "다음" 버튼 클릭
            const nextButton = await this.page.locator('a:has-text("다음")').first();
            await nextButton.click();

            // 페이지 로드 대기
            await this.page.waitForTimeout(2000);
            currentPage++;
          } catch (err) {
            console.warn('[Playwright] 다음 페이지 이동 실패:', err);
            hasNextPage = false;
          }
        } else {
          console.log('[Playwright] 다음 페이지가 없습니다. 종료합니다.');
          hasNextPage = false;
        }
      }

      result.completedAt = new Date().toISOString();
      result.success = true;

      // 최종 결과 출력
      console.log(`\n[Playwright] ===== 최종 결과 =====`);
      console.log(`총 페이지: ${result.totalPages}개`);
      console.log(`총 처리: ${result.totalProcessed}개`);
      console.log(`✅ 좋아요 누른 글: ${result.totalLiked}개`);
      console.log(`❌ 좋아요 못 누른 글: ${result.totalFailed}개`);
      console.log(`⏭️  이미 좋아요된 글: ${result.totalProcessed - result.totalLiked - result.totalFailed}개`);

      // 좋아요 누른 글 목록
      if (result.totalLiked > 0) {
        console.log(`\n[좋아요 누른 글]`);
        result.details
          .filter((d) => d.liked)
          .forEach((d) => {
            console.log(`  - [페이지 ${d.page}] ${d.title}`);
          });
      }

      // 좋아요 못 누른 글 목록
      const failedDetails = result.details.filter((d) => !d.liked);
      if (failedDetails.length > 0) {
        console.log(`\n[좋아요 못 누른 글]`);
        failedDetails.forEach((d) => {
          console.log(`  - [페이지 ${d.page}] ${d.title}`);
          if (d.reason) {
            console.log(`    이유: ${d.reason}`);
          }
        });
      }

      return result;
    } catch (error) {
      console.error('[Playwright] 이웃새글 좋아요 오류:', error);
      result.success = false;
      result.completedAt = new Date().toISOString();
      return result;
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
      let postsProcessed = 0;
      let postsLiked = 0;

      try {
        console.log(`\n[Process] 처리 중: ${neighbor.nickname} (${neighbor.blogId})`);

        // 최근 글 목록 조회
        const posts = await automation.getRecentPosts(neighbor.blogUrl, daysLimit);

        // 기준 날짜 계산
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
        console.log(`[Process] 날짜 필터: ${cutoffDate.toLocaleDateString('ko-KR')} 이후만 처리`);

        // 각 글에 좋아요 누르기 (날짜 필터링 포함)
        for (const post of posts) {
          try {
            let postDate: Date | null = null;

            // 우선 1: 글 목록에서 가져온 날짜 사용
            if (post.date) {
              console.log(`[${neighbor.nickname}] 글 목록 날짜: ${post.date}`);

              // 날짜 문자열 파싱
              const dateMatch = post.date.match(/(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/);
              if (dateMatch) {
                postDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
              }
            }

            // 우선 2: 글 목록에서 날짜를 찾지 못하면 글 페이지에서 파싱
            if (!postDate) {
              console.log(`[${neighbor.nickname}] 글 페이지에서 날짜 파싱 시도...`);
              postDate = await automation.getPostDate(post.url);
            }

            // 날짜 확인 (로깅만 하고 필터링하지 않음 - 안정성 우선)
            if (postDate) {
              const isWithinDays = postDate >= cutoffDate;
              const withinText = isWithinDays ? '✓' : '⏭️ (7일 이상)';
              console.log(
                `${withinText} [${neighbor.nickname}] ${post.title} (${postDate.toLocaleDateString('ko-KR')})`
              );
            } else {
              console.log(`ℹ️ [${neighbor.nickname}] 날짜 정보 없음: ${post.title}`);
            }

            // ⭐ 모든 글에 좋아요 시도 (날짜 관계없이)

            // 좋아요 누르기
            const liked = await automation.toggleLike(post.url);
            postsProcessed++;
            result.totalProcessed++;

            if (liked) {
              postsLiked++;
              result.totalLiked++;
              console.log(`✅ [${neighbor.nickname}] 좋아요 완료: ${post.title}`);
            } else {
              console.log(`ℹ️ [${neighbor.nickname}] 이미 좋아요됨 또는 실패: ${post.title}`);
            }

            // 너무 빠른 요청 방지 (1~2초 대기)
            await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
          } catch (error) {
            const errorMsg = `글 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
            console.error(errorMsg);
            result.errors.push(`${neighbor.nickname} - ${post.title}: ${errorMsg}`);
          }
        }

        result.neighborStats.push({
          nickname: neighbor.nickname,
          postsProcessed,
          postsLiked,
        });

        console.log(
          `[Process] ${neighbor.nickname} 완료: ${postsProcessed}개 처리, ${postsLiked}개 좋아요`
        );
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
