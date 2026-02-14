const { chromium } = require('playwright');

async function testSubmitComment() {
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
    const btnClicked = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) {
        console.log('[evaluate] iframe 없음');
        return false;
      }

      const commentBtn = iframeDoc.getElementById('btn_comment_2');
      if (!commentBtn) {
        console.log('[evaluate] 댓글 버튼 없음');
        return false;
      }

      console.log('[evaluate] 댓글 버튼 클릭');
      commentBtn.click();
      return true;
    });

    if (!btnClicked) {
      console.log('❌ 댓글 버튼 클릭 실패');
      await browser.close();
      return;
    }

    await page.waitForTimeout(2000);

    // naverComment 컨테이너 확인 (메인 페이지 + iframe 모두)
    console.log('[TEST] === naverComment 컨테이너 확인 ===\n');
    const containerExists = await page.evaluate(() => {
      // 메인 페이지 확인
      let container = document.querySelector('div[id*="naverComment"][class*="u_cbox"]');
      if (container) {
        return {
          location: 'mainPage',
          id: container.id,
          class: container.className,
          visible: container.offsetHeight > 0,
        };
      }

      // iframe 내부 확인
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (iframeDoc) {
        container = iframeDoc.querySelector('div[id*="naverComment"][class*="u_cbox"]');
        if (container) {
          return {
            location: 'iframe',
            id: container.id,
            class: container.className,
            visible: container.offsetHeight > 0,
          };
        }
      }

      return { error: 'naverComment 컨테이너 없음' };
    });

    console.log(JSON.stringify(containerExists, null, 2));

    if (containerExists.error) {
      console.log('❌ naverComment 컨테이너 찾기 실패');
      await browser.close();
      return;
    }

    // contenteditable div 찾기 (메인 페이지 + iframe)
    console.log('\n[TEST] === contenteditable div 찾기 ===\n');
    const editableDivInfo = await page.evaluate(() => {
      // 메인 페이지 먼저 확인
      let editableDiv = document.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (editableDiv) {
        return {
          location: 'mainPage',
          id: editableDiv.id,
          tag: editableDiv.tagName,
          contentEditable: editableDiv.contentEditable,
          visible: editableDiv.offsetHeight > 0,
        };
      }

      // iframe 내부 확인
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (iframeDoc) {
        editableDiv = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
        if (editableDiv) {
          return {
            location: 'iframe',
            id: editableDiv.id,
            tag: editableDiv.tagName,
            contentEditable: editableDiv.contentEditable,
            visible: editableDiv.offsetHeight > 0,
          };
        }
      }

      return { error: '찾기 실패' };
    });

    console.log(JSON.stringify(editableDivInfo, null, 2));

    if (editableDivInfo.error) {
      console.log('⚠️  contenteditable div를 찾기 실패, 폴백 시도...');
    } else {
      console.log(`✓ contenteditable div 발견! (위치: ${editableDivInfo.location})`);
    }

    // Step 1: 댓글 입력
    console.log('\n[TEST] === 댓글 입력 중 ===\n');
    const inputSuccess = await page.evaluate((comment) => {
      console.log(`[evaluate] 댓글 입력: "${comment}"`);

      // iframe 내부에서 먼저 검색
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      if (iframeDoc) {
        // 방법 1: contenteditable div ID로 찾기 (iframe 내부)
        let editableDiv = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');

        if (editableDiv && editableDiv.contentEditable === 'true') {
          console.log('[evaluate] ✓ iframe 내부 contenteditable div 발견');
          editableDiv.focus();
          editableDiv.textContent = comment;
          editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
          editableDiv.dispatchEvent(new Event('change', { bubbles: true }));
          editableDiv.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          console.log('[evaluate] ✓ 텍스트 입력 완료 (iframe)');
          return true;
        }

        // 방법 2: 모든 contenteditable div 검색 (iframe 내부)
        const editableDivs = iframeDoc.querySelectorAll('div[contenteditable="true"]');
        console.log(`[evaluate] iframe 내부 contenteditable div 검색 (${editableDivs.length}개)`);

        for (const div of Array.from(editableDivs)) {
          const parent = div.closest('[id*="naverComment"]');
          if (parent) {
            console.log('[evaluate] ✓ iframe 내부 naverComment 내 contenteditable div 발견');
            div.focus();
            div.textContent = comment;
            div.dispatchEvent(new Event('input', { bubbles: true }));
            div.dispatchEvent(new Event('change', { bubbles: true }));
            div.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            return true;
          }
        }
      }

      // 메인 페이지에서 검색 (호환성)
      let editableDiv = document.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (editableDiv && editableDiv.contentEditable === 'true') {
        console.log('[evaluate] ✓ 메인 페이지 contenteditable div 발견');
        editableDiv.focus();
        editableDiv.textContent = comment;
        editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
        editableDiv.dispatchEvent(new Event('change', { bubbles: true }));
        editableDiv.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        console.log('[evaluate] ✓ 텍스트 입력 완료 (메인)');
        return true;
      }

      const editableDivs = document.querySelectorAll('div[contenteditable="true"]');
      console.log(`[evaluate] 메인 페이지 contenteditable div 검색 (${editableDivs.length}개)`);

      for (const div of Array.from(editableDivs)) {
        const parent = div.closest('[id*="naverComment"]');
        if (parent) {
          console.log('[evaluate] ✓ 메인 페이지 naverComment 내 contenteditable div 발견');
          div.focus();
          div.textContent = comment;
          div.dispatchEvent(new Event('input', { bubbles: true }));
          div.dispatchEvent(new Event('change', { bubbles: true }));
          div.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          return true;
        }
      }

      console.log('[evaluate] ❌ 입력 필드를 찾을 수 없습니다');
      return false;
    }, testComment);

    if (!inputSuccess) {
      console.log('❌ 댓글 입력 실패');
      await browser.close();
      return;
    }

    console.log('✓ 댓글 입력 완료');

    // 입력 내용 확인
    await page.waitForTimeout(1000);
    const inputContent = await page.evaluate(() => {
      const editableDiv = document.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (!editableDiv) {
        const allDivs = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
        const naverDiv = allDivs.find(div => div.closest('[id*="naverComment"]'));
        return { content: naverDiv?.textContent || '' };
      }
      return { content: editableDiv.textContent || '' };
    });

    console.log('\n[TEST] === 입력된 내용 확인 ===\n');
    console.log(`입력된 텍스트: "${inputContent.content}"`);

    // Step 2: 제출 버튼 클릭
    console.log('\n[TEST] === 댓글 제출 ===\n');
    const submitSuccess = await page.evaluate(() => {
      let submitBtn = null;

      // iframe 내부에서 먼저 찾기
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      if (iframeDoc) {
        const buttons = iframeDoc.querySelectorAll('button');
        console.log(`[evaluate] iframe 내부 button 검색 (${buttons.length}개)`);

        for (const btn of Array.from(buttons)) {
          const parent = btn.closest('[id*="naverComment"]');
          const text = btn.textContent?.toLowerCase() || '';
          const className = btn.className || '';

          if (parent && (text.includes('등록') || className.includes('u_cbox_btn_upload'))) {
            submitBtn = btn;
            console.log(`[evaluate] ✓ iframe 내부 제출 버튼 발견: "${text.trim()}"`);
            break;
          }
        }
      }

      // 메인 페이지에서 찾기 (호환성)
      if (!submitBtn) {
        const buttons = document.querySelectorAll('button');
        console.log(`[evaluate] 메인 페이지 button 검색 (${buttons.length}개)`);

        for (const btn of Array.from(buttons)) {
          const parent = btn.closest('[id*="naverComment"]');
          const text = btn.textContent?.toLowerCase() || '';
          const className = btn.className || '';

          if (parent && (text.includes('등록') || className.includes('u_cbox_btn_upload'))) {
            submitBtn = btn;
            console.log(`[evaluate] ✓ 메인 페이지 제출 버튼 발견: "${text.trim()}"`);
            break;
          }
        }
      }

      if (!submitBtn) {
        console.log('[evaluate] ❌ 제출 버튼을 찾을 수 없습니다');
        return false;
      }

      try {
        console.log('[evaluate] 제출 버튼 클릭...');
        submitBtn.click();
        return true;
      } catch (e) {
        console.log('[evaluate] 제출 클릭 실패:', e);
        return false;
      }
    });

    if (!submitSuccess) {
      console.log('❌ 댓글 제출 실패');
      await browser.close();
      return;
    }

    console.log('✓ 제출 버튼 클릭 완료');

    // 제출 완료 확인
    console.log('\n[TEST] === 제출 완료 대기 ===\n');
    await page.waitForTimeout(3000);

    const finalState = await page.evaluate(() => {
      const editableDiv = document.querySelector('[id*="naverComment"][id*="write_textarea"]');
      const allDivs = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
      const naverDiv = allDivs.find(div => div.closest('[id*="naverComment"]'));

      const currentText = editableDiv?.textContent || naverDiv?.textContent || '';

      return {
        inputTextCleared: currentText === '',
        currentText: currentText,
      };
    });

    console.log(JSON.stringify(finalState, null, 2));

    if (finalState.inputTextCleared) {
      console.log('\n✅ 댓글 제출 완료! (입력 필드 초기화됨)');
    } else {
      console.log('\n⚠️  입력 필드가 아직 초기화되지 않았습니다.');
    }

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testSubmitComment().catch(console.error);
