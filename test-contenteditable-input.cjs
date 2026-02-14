const { chromium } = require('playwright');

async function testContenteditableInput() {
  const blogId = 'wltnwl2';
  const blogPassword = 'wogns0513@';
  const postUrl = 'https://blog.naver.com/ssyeonee27/224183679576';
  const testComment = '좋은 글 감사합니다!';

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

    // contenteditable div 찾기 및 상세 분석
    console.log('[TEST] === contenteditable div 상세 분석 ===\n');

    const divAnalysis = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      const div = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (!div) return { error: 'div 없음' };

      console.log('[evaluate] ✓ contenteditable div 발견');
      console.log('[evaluate] - id:', div.id);
      console.log('[evaluate] - class:', div.className);
      console.log('[evaluate] - contenteditable:', div.contentEditable);
      console.log('[evaluate] - data-area-code:', div.getAttribute('data-area-code'));

      return {
        found: true,
        id: div.id,
        class: div.className,
        contentEditable: div.contentEditable,
        dataAreaCode: div.getAttribute('data-area-code'),
        textContent: div.textContent,
        innerHTML: div.innerHTML,
        innerText: div.innerText,
        childNodes: div.childNodes.length,
      };
    });

    console.log(JSON.stringify(divAnalysis, null, 2));

    // 3가지 방식으로 텍스트 입력 시도
    console.log('\n[TEST] === 텍스트 입력 3가지 방식 테스트 ===\n');

    const inputResults = await page.evaluate((comment) => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      const div = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (!div) return { error: 'div 없음' };

      const results = [];

      // 방법 1: textContent 설정
      console.log('[evaluate] 방법 1: textContent 설정');
      div.focus();
      div.textContent = comment;
      div.dispatchEvent(new Event('input', { bubbles: true }));
      div.dispatchEvent(new Event('change', { bubbles: true }));
      const result1 = {
        method: 'textContent',
        set: comment,
        current: div.textContent,
        innerHTML: div.innerHTML,
        childNodes: div.childNodes.length,
      };
      results.push(result1);
      console.log('[evaluate] 결과:', JSON.stringify(result1));

      // 방법 2: innerHTML 설정
      console.log('[evaluate] 방법 2: innerHTML 설정');
      div.focus();
      div.innerHTML = comment;
      div.dispatchEvent(new Event('input', { bubbles: true }));
      div.dispatchEvent(new Event('change', { bubbles: true }));
      const result2 = {
        method: 'innerHTML',
        set: comment,
        current: div.textContent,
        innerHTML: div.innerHTML,
        childNodes: div.childNodes.length,
      };
      results.push(result2);
      console.log('[evaluate] 결과:', JSON.stringify(result2));

      // 방법 3: 텍스트 노드 생성
      console.log('[evaluate] 방법 3: 텍스트 노드 생성 및 추가');
      div.focus();
      div.innerHTML = '';
      const textNode = document.createTextNode(comment);
      div.appendChild(textNode);
      div.dispatchEvent(new Event('input', { bubbles: true }));
      div.dispatchEvent(new Event('change', { bubbles: true }));
      const result3 = {
        method: '텍스트노드 추가',
        set: comment,
        current: div.textContent,
        innerHTML: div.innerHTML,
        childNodes: div.childNodes.length,
      };
      results.push(result3);
      console.log('[evaluate] 결과:', JSON.stringify(result3));

      return results;
    }, testComment);

    console.log('\n[TEST] === 입력 결과 비교 ===\n');
    console.log(JSON.stringify(inputResults, null, 2));

    // 최종: 어느 방식이 가장 잘 작동하는지 확인
    console.log('\n[TEST] === 최종 상태 확인 ===\n');

    const finalState = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      const div = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (!div) return { error: 'div 없음' };

      return {
        textContent: div.textContent,
        innerHTML: div.innerHTML,
        innerText: div.innerText,
        childNodes: Array.from(div.childNodes).map((node, idx) => ({
          index: idx,
          type: node.nodeType === 3 ? 'TEXT' : node.nodeName,
          content: node.textContent?.substring(0, 100),
        })),
      };
    });

    console.log(JSON.stringify(finalState, null, 2));

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testContenteditableInput().catch(console.error);
