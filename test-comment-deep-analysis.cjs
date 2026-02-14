const { chromium } = require('playwright');

async function deepAnalyzeCommentStructure() {
  const blogId = 'wltnwl2';
  const blogPassword = 'wogns0513@';
  const postUrl = 'https://blog.naver.com/ssyeonee27/224183679576';

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    // 1단계: 로그인
    console.log('[TEST] === 로그인 시작 ===\n');
    await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const idField = await page.$('input#id');
    const pwField = await page.$('input#pw');
    if (idField && pwField) {
      await idField.fill(blogId);
      await pwField.fill(blogPassword);
      const loginBtn = await page.$('button.btn_login');
      if (loginBtn) {
        await loginBtn.click();
        try {
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (e) {}
        await page.waitForTimeout(2000);
      }
    }

    // 2단계: 글 페이지로 이동
    console.log('[TEST] === 글 페이지 접속 ===\n');
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 3단계: iframe 내부의 댓글 버튼 정확히 분석
    console.log('[TEST] === iframe 내부 댓글 버튼 분석 ===\n');

    const btnAnalysis = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      // .area_comment 찾기
      const areaComment = iframeDoc.querySelector('.area_comment');
      if (!areaComment) return { error: '.area_comment 없음' };

      console.log('[FOUND] .area_comment 발견!');

      // areaComment 내부의 모든 자식 요소 분석
      const children = areaComment.children;
      const childAnalysis = [];
      for (let i = 0; i < Math.min(children.length, 5); i++) {
        const child = children[i];
        childAnalysis.push({
          index: i,
          tag: child.tagName,
          id: child.id,
          class: child.className,
          text: child.textContent?.trim().substring(0, 50),
          onclick: child.onclick ? 'yes' : 'no',
        });
      }

      // areaComment의 클릭 가능한 요소들
      const clickables = areaComment.querySelectorAll('a, button, [onclick], [role="button"]');
      const clickableAnalysis = [];
      clickables.forEach((el, idx) => {
        if (clickableAnalysis.length < 5) {
          clickableAnalysis.push({
            index: idx,
            tag: el.tagName,
            id: el.id,
            class: el.className,
            text: el.textContent?.trim().substring(0, 30),
            href: el.getAttribute('href'),
            onclick: el.onclick ? 'yes' : 'no',
            roleButton: el.getAttribute('role'),
          });
        }
      });

      // 댓글 관련 id들 찾기
      const allIds = Array.from(iframeDoc.querySelectorAll('[id*="comment"], [id*="reply"], [id*="cmt"]'));
      const idAnalysis = allIds.slice(0, 10).map(el => ({
        id: el.id,
        tag: el.tagName,
        class: el.className,
        visible: el.offsetHeight > 0,
      }));

      return {
        areaCommentFound: !!areaComment,
        areaCommentClass: areaComment.className,
        areaCommentTag: areaComment.tagName,
        parentTag: areaComment.parentElement?.tagName,
        parentClass: areaComment.parentElement?.className,
        children: childAnalysis,
        clickableElements: clickableAnalysis,
        allCommentRelatedIds: idAnalysis,
      };
    });

    console.log(JSON.stringify(btnAnalysis, null, 2));

    // 4단계: 댓글 버튼을 더 정확하게 클릭 시도
    console.log('\n[TEST] === 다양한 클릭 방법 시도 ===\n');

    const clickResults = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      const results = [];

      // 방법 1: .area_comment 직접 클릭
      const areaComment = iframeDoc.querySelector('.area_comment');
      if (areaComment) {
        try {
          console.log('[METHOD 1] .area_comment 직접 클릭');
          areaComment.click();
          results.push({ method: 'area_comment.click()', success: true });
        } catch (e) {
          results.push({ method: 'area_comment.click()', success: false, error: e.message });
        }
      }

      // 방법 2: .area_comment 내부의 a 태그 클릭
      const linkInArea = areaComment?.querySelector('a');
      if (linkInArea) {
        try {
          console.log('[METHOD 2] area_comment > a 클릭');
          linkInArea.click();
          results.push({ method: 'area_comment > a', success: true });
        } catch (e) {
          results.push({ method: 'area_comment > a', success: false, error: e.message });
        }
      }

      // 방법 3: area_comment 내부에서 onclick 찾기
      const elementsWithOnclick = areaComment?.querySelectorAll('[onclick]');
      if (elementsWithOnclick && elementsWithOnclick.length > 0) {
        try {
          console.log(`[METHOD 3] [onclick] 요소 (${elementsWithOnclick.length}개 발견) 클릭`);
          elementsWithOnclick[0].click();
          results.push({ method: '[onclick]', success: true, count: elementsWithOnclick.length });
        } catch (e) {
          results.push({ method: '[onclick]', success: false, error: e.message });
        }
      }

      // 방법 4: 댓글 버튼 id로 직접 찾기 (logNo 기반)
      // URL에서 글번호 추출: /224183679576 → 224183679576
      const postNum = '224183679576';
      const commentBtnId = `area_sympathy${postNum}`;
      const commentBtn = iframeDoc.getElementById(commentBtnId);
      if (commentBtn) {
        try {
          console.log(`[METHOD 4] ID로 찾은 댓글 버튼 클릭: ${commentBtnId}`);
          commentBtn.click();
          results.push({ method: `ID: ${commentBtnId}`, success: true });
        } catch (e) {
          results.push({ method: `ID: ${commentBtnId}`, success: false, error: e.message });
        }
      }

      return results;
    });

    console.log('[CLICK RESULTS]:', JSON.stringify(clickResults, null, 2));

    // 5단계: 클릭 후 다시 상태 확인
    console.log('\n[TEST] === 클릭 후 상태 재확인 ===\n');
    await page.waitForTimeout(2000);

    const afterClickState = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      // 메인 페이지
      const mainTextareas = document.querySelectorAll('textarea');
      const mainInputs = document.querySelectorAll('input');
      const mainCommentContainers = document.querySelectorAll('[id*="naverComment"]');

      // iframe 내부
      let iframeTextareas = 0;
      let iframeInputs = 0;
      let iframeCommentContainers = 0;

      if (iframeDoc) {
        iframeTextareas = iframeDoc.querySelectorAll('textarea').length;
        iframeInputs = iframeDoc.querySelectorAll('input').length;
        iframeCommentContainers = iframeDoc.querySelectorAll('[id*="naverComment"]').length;
      }

      return {
        mainPage: {
          textareas: mainTextareas.length,
          inputs: mainInputs.length,
          naverCommentContainers: mainCommentContainers.length,
        },
        iframe: {
          textareas: iframeTextareas,
          inputs: iframeInputs,
          naverCommentContainers: iframeCommentContainers,
        },
      };
    });

    console.log(JSON.stringify(afterClickState, null, 2));

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

deepAnalyzeCommentStructure().catch(console.error);
