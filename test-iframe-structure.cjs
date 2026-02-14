const { chromium } = require('playwright');

async function analyzeIframeStructure() {
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
    // 빠른 로그인
    console.log('[TEST] === 로그인 진행 중 ===\n');
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
      }
    }

    console.log('⏳ 2차 인증을 완료해주세요...\n');

    // 2차 인증 대기
    let loginComplete = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      if (!currentUrl.includes('nid.naver.com/nidlogin')) {
        console.log(`✓ 로그인 완료\n`);
        loginComplete = true;
        break;
      }
    }

    if (!loginComplete) {
      console.log('❌ 로그인 타임아웃');
      await browser.close();
      return;
    }

    await page.waitForTimeout(2000);

    // 글 페이지로 이동
    console.log('[TEST] === 글 페이지 접속 ===\n');
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 댓글 버튼 클릭
    console.log('[TEST] === 댓글 버튼 클릭 ===\n');
    await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (iframeDoc) {
        const commentBtn = iframeDoc.getElementById('btn_comment_2');
        if (commentBtn) {
          commentBtn.click();
        }
      }
    });

    await page.waitForTimeout(2000);

    // iframe 내부의 정확한 구조 분석
    console.log('[TEST] === iframe 내부 구조 분석 ===\n');

    const iframeAnalysis = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      if (!iframeDoc) return { error: 'iframe contentDocument 없음' };

      // 모든 iframe 찾기
      const allIframes = iframeDoc.querySelectorAll('iframe');
      console.log(`[evaluate] iframe 내부 iframe 개수: ${allIframes.length}`);

      // naverComment 컨테이너
      const container = iframeDoc.querySelector('[id*="naverComment"][class*="u_cbox"]');
      if (!container) return { error: 'naverComment 컨테이너 없음 (iframe 내부)' };

      console.log('[evaluate] ✓ naverComment 컨테이너 발견');

      // contenteditable 요소들
      const editableDivs = container.querySelectorAll('[contenteditable="true"]');
      const editableDivsList = Array.from(editableDivs).map((div, idx) => ({
        index: idx,
        id: div.id,
        class: div.className,
        visible: div.offsetHeight > 0,
        height: div.offsetHeight,
      }));

      console.log(`[evaluate] contenteditable div: ${editableDivs.length}개`);

      // 모든 자식 요소
      const children = container.children;
      const childrenList = Array.from(children).slice(0, 10).map((child, idx) => ({
        index: idx,
        tag: child.tagName,
        id: child.id,
        class: child.className,
        visible: child.offsetHeight > 0,
      }));

      // input/textarea 찾기
      const inputs = container.querySelectorAll('input, textarea');
      const inputsList = Array.from(inputs).filter(input => input.offsetHeight > 0 || input.offsetWidth > 0).slice(0, 5).map(input => ({
        tag: input.tagName,
        id: input.id,
        name: input.name,
        type: input instanceof HTMLInputElement ? input.type : 'textarea',
        visible: input.offsetHeight > 0,
      }));

      // u_cbox_write_area 내부
      const writeArea = container.querySelector('.u_cbox_write_area');
      let writeAreaAnalysis = null;
      if (writeArea) {
        const writeAreaChildren = Array.from(writeArea.children).map((child, idx) => ({
          index: idx,
          tag: child.tagName,
          id: child.id,
          class: child.className,
          visible: child.offsetHeight > 0,
          innerHTML: child.innerHTML.substring(0, 100),
        }));

        writeAreaAnalysis = {
          found: true,
          childrenCount: writeArea.children.length,
          children: writeAreaChildren.slice(0, 5),
        };
      }

      return {
        iframesInside: allIframes.length,
        containerFound: !!container,
        container: {
          id: container.id,
          class: container.className,
        },
        editableDivs: editableDivsList,
        children: childrenList,
        inputs: inputsList,
        writeArea: writeAreaAnalysis,
      };
    });

    console.log(JSON.stringify(iframeAnalysis, null, 2));

    // 더 깊이 있는 분석: u_cbox_inbox 내부
    console.log('\n[TEST] === u_cbox_inbox 내부 분석 ===\n');

    const inboxAnalysis = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      const container = iframeDoc.querySelector('[id*="naverComment"][class*="u_cbox"]');
      if (!container) return { error: 'naverComment 컨테이너 없음' };

      // u_cbox_inbox 찾기
      const inbox = container.querySelector('.u_cbox_inbox');
      if (!inbox) return { error: 'u_cbox_inbox 없음' };

      console.log('[evaluate] ✓ u_cbox_inbox 발견');

      // inbox 내부의 모든 요소
      const allElements = inbox.querySelectorAll('*');
      const elementsList = Array.from(allElements).slice(0, 20).map((el, idx) => ({
        index: idx,
        tag: el.tagName,
        id: el.id,
        class: el.className,
        contentEditable: el.contentEditable,
        visible: el.offsetHeight > 0,
      }));

      // contenteditable="true"인 요소 찾기
      const editableInInbox = inbox.querySelectorAll('[contenteditable="true"]');
      const editableList = Array.from(editableInInbox).map((el, idx) => ({
        index: idx,
        tag: el.tagName,
        id: el.id,
        class: el.className,
        visible: el.offsetHeight > 0,
        text: el.textContent?.substring(0, 50),
      }));

      return {
        inboxFound: true,
        allElementsCount: allElements.length,
        elements: elementsList,
        editableCount: editableInInbox.length,
        editables: editableList,
      };
    });

    console.log(JSON.stringify(inboxAnalysis, null, 2));

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

analyzeIframeStructure().catch(console.error);
