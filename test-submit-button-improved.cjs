const { chromium } = require('playwright');

async function testSubmitButtonImproved() {
  const blogId = 'wltnwl2';
  const blogPassword = 'wogns0513@';
  const postUrl = 'https://blog.naver.com/ssyeonee27/224183679576';
  const testComment = '이 글이 정말 도움 되었어요~';

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
    // 로그인
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

    // Step 1: 댓글 버튼 클릭
    console.log('[TEST] === Step 1: 댓글 버튼 클릭 ===\n');
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
      console.log('❌ 댓글 버튼 클릭 실패\n');
      await browser.close();
      return;
    }

    console.log('✓ 댓글 버튼 클릭 완료\n');
    await page.waitForTimeout(2000);

    // Step 2: 컨테이너 감지
    console.log('[TEST] === Step 2: 나버코멘트 컨테이너 감지 ===\n');
    let containerReady = false;
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(100);

      const checkResult = await page.evaluate(() => {
        const iframe = document.querySelector('iframe#mainFrame');
        const iframeDoc = iframe?.contentDocument;

        if (iframeDoc) {
          const container = iframeDoc.querySelector('div[id*="naverComment"][class*="u_cbox"]');
          if (container) {
            return { found: true, location: 'iframe', id: container.id };
          }
        }

        return { found: false, location: '', id: '' };
      });

      if (checkResult.found) {
        containerReady = true;
        console.log(`✓ 댓글 입력창 준비됨 (ID: ${checkResult.id})\n`);
        break;
      }
    }

    if (!containerReady) {
      console.log('❌ 댓글 입력창 시간 초과\n');
      await browser.close();
      return;
    }

    // Step 3: 텍스트 입력
    console.log('[TEST] === Step 3: 댓글 입력 ===\n');
    const inputResult = await page.evaluate((comment) => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      if (iframeDoc) {
        const editableDiv = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
        if (editableDiv && editableDiv.contentEditable === 'true') {
          editableDiv.focus();
          editableDiv.textContent = comment;
          editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
          editableDiv.dispatchEvent(new Event('change', { bubbles: true }));
          editableDiv.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          return {
            success: true,
            divId: editableDiv.id,
            textContent: editableDiv.textContent
          };
        }
      }

      return { success: false };
    }, testComment);

    if (!inputResult.success) {
      console.log('❌ 댓글 입력 실패\n');
      await browser.close();
      return;
    }

    console.log(`✓ 댓글 입력 성공: "${inputResult.textContent}"\n`);
    await page.waitForTimeout(500);

    // Step 4: 개선된 제출 버튼 클릭
    console.log('[TEST] === Step 4: 개선된 제출 버튼 선택 ===\n');
    const submitResult = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      if (!iframeDoc) {
        console.log('[evaluate] iframe 없음');
        return { success: false, reason: 'iframe 없음' };
      }

      const buttons = iframeDoc.querySelectorAll('button');
      console.log(`[evaluate] iframe 내부 button 개수: ${buttons.length}`);

      let submitBtn = null;

      // Strategy 1: "등록" 텍스트로 찾기
      for (const btn of Array.from(buttons)) {
        const text = btn.textContent?.trim() || '';
        const className = btn.className || '';
        const parent = btn.closest('[id*="naverComment"]');

        if (parent && text === '등록' && !className.includes('sticker')) {
          console.log(`[evaluate] ✓ Strategy 1: "등록" 텍스트로 발견`);
          console.log(`[evaluate]   text="${text}", class="${className}"`);
          submitBtn = btn;
          break;
        }
      }

      // Strategy 2: .u_cbox_upload 내부 마지막 비-스티커 버튼
      if (!submitBtn) {
        const container = iframeDoc.querySelector('div[id*="naverComment"][class*="u_cbox"]');
        if (container) {
          const uploadArea = container.querySelector('.u_cbox_upload');
          if (uploadArea) {
            const uploadButtons = uploadArea.querySelectorAll('button');
            console.log(`[evaluate] Strategy 2: .u_cbox_upload 내부 button ${uploadButtons.length}개`);

            for (let i = uploadButtons.length - 1; i >= 0; i--) {
              const btn = uploadButtons[i];
              const className = btn.className || '';
              const text = btn.textContent?.trim() || '';

              console.log(`[evaluate]   [${i}] text="${text}", class="${className}"`);

              if (!className.includes('sticker')) {
                console.log(`[evaluate] ✓ Strategy 2: 마지막 비-스티커 버튼 선택`);
                submitBtn = btn;
                break;
              }
            }
          }
        }
      }

      // Strategy 3: CSS selector
      if (!submitBtn) {
        const nonStickerButtons = iframeDoc.querySelectorAll('button.u_cbox_btn_upload:not(.sticker)');
        console.log(`[evaluate] Strategy 3: u_cbox_btn_upload:not(.sticker) ${nonStickerButtons.length}개`);
        if (nonStickerButtons.length > 0) {
          submitBtn = nonStickerButtons[nonStickerButtons.length - 1];
          console.log(`[evaluate] ✓ Strategy 3: 선택됨`);
        }
      }

      if (!submitBtn) {
        // 디버그: 모든 버튼 출력
        console.log('[evaluate] ❌ 제출 버튼 미발견 - 모든 버튼:');
        for (const btn of Array.from(buttons)) {
          const className = btn.className || '';
          const text = btn.textContent?.trim() || '';
          const parent = btn.closest('[id*="naverComment"]');
          console.log(`[evaluate]   text="${text}", class="${className}", inComment=${!!parent}`);
        }
        return { success: false, reason: '제출 버튼 미발견' };
      }

      try {
        console.log(`[evaluate] 클릭할 버튼: text="${submitBtn.textContent?.trim()}", class="${submitBtn.className}"`);
        submitBtn.click();
        return { success: true, buttonText: submitBtn.textContent?.trim(), buttonClass: submitBtn.className };
      } catch (e) {
        console.log('[evaluate] 클릭 실패:', e);
        return { success: false, reason: '클릭 실패' };
      }
    });

    console.log('\nStep 4 결과:');
    console.log(JSON.stringify(submitResult, null, 2));

    if (!submitResult.success) {
      console.log(`\n❌ 제출 버튼 클릭 실패: ${submitResult.reason}`);
      await browser.close();
      return;
    }

    console.log('\n✓ 제출 버튼 클릭 완료\n');
    await page.waitForTimeout(3000);

    // 최종 확인
    console.log('[TEST] === 최종 상태 확인 ===\n');
    const finalState = await page.evaluate(() => {
      const editableDiv = document.querySelector('[id*="naverComment"][id*="write_textarea"]');
      const currentText = editableDiv?.textContent || '';
      return { inputTextCleared: currentText === '', currentText };
    });

    console.log(JSON.stringify(finalState, null, 2));

    if (finalState.inputTextCleared) {
      console.log('\n✅ 댓글 제출 완료!\n');
    } else {
      console.log('\n⚠️  입력 필드가 초기화되지 않았습니다.\n');
    }

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testSubmitButtonImproved().catch(console.error);
