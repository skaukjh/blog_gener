const { chromium } = require('playwright');

async function testFullFlow() {
  const blogId = 'wltnwl2';
  const blogPassword = 'wogns0513@';
  const postUrl = 'https://blog.naver.com/ssyeonee27/224183679576';
  const testComment = '정말 좋은 글이에요!';

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
    // 1. 로그인
    console.log('\n[TEST] ========== FULL FLOW TEST ==========\n');
    console.log('[TEST] Step 1: 로그인\n');
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

    // 2. 글 페이지 이동
    console.log('[TEST] Step 2: 글 페이지 이동\n');
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log(`✓ 글 페이지 로드: ${postUrl}\n`);

    // 3. 댓글 버튼 클릭
    console.log('[TEST] Step 3: 댓글 버튼 클릭\n');
    const btnClicked = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) {
        console.log('[iframe] iframe 없음');
        return false;
      }

      const commentBtn = iframeDoc.getElementById('btn_comment_2');
      if (!commentBtn) {
        console.log('[iframe] 댓글 버튼 없음');
        return false;
      }

      console.log('[iframe] 댓글 버튼 클릭');
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

    // 4. naverComment 컨테이너 확인
    console.log('[TEST] Step 4: naverComment 컨테이너 확인\n');
    const containerReady = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return false;

      const container = iframeDoc.querySelector('div[id*="naverComment"][class*="u_cbox"]');
      return !!container;
    });

    if (!containerReady) {
      console.log('❌ naverComment 컨테이너 없음\n');
      await browser.close();
      return;
    }

    console.log('✓ naverComment 컨테이너 준비됨\n');

    // 5. contenteditable div에 텍스트 입력
    console.log('[TEST] Step 5: 댓글 입력\n');
    const inputSuccess = await page.evaluate((comment) => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) {
        console.log('[iframe] iframe 없음');
        return false;
      }

      const div = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (!div) {
        console.log('[iframe] contenteditable div 없음');
        return false;
      }

      console.log(`[iframe] ✓ contenteditable div 발견: ${div.id}`);

      // focus 후 텍스트 입력
      div.focus();
      div.textContent = comment;

      // 이벤트 발생
      div.dispatchEvent(new Event('input', { bubbles: true }));
      div.dispatchEvent(new Event('change', { bubbles: true }));
      div.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

      console.log(`[iframe] ✓ 텍스트 입력 완료: "${comment}"`);
      console.log(`[iframe] 현재 textContent: "${div.textContent}"`);

      return true;
    }, testComment);

    if (!inputSuccess) {
      console.log('❌ 댓글 입력 실패\n');
      await browser.close();
      return;
    }

    console.log('✓ 댓글 입력 완료\n');
    await page.waitForTimeout(1000);

    // 6. 입력 내용 최종 확인
    console.log('[TEST] Step 6: 입력 내용 확인\n');
    const inputContent = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      const div = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
      if (!div) return { error: 'div 없음' };

      return {
        textContent: div.textContent,
        innerHTML: div.innerHTML,
        childNodes: div.childNodes.length,
      };
    });

    console.log('입력된 내용:');
    console.log(JSON.stringify(inputContent, null, 2));
    console.log();

    if (!inputContent.textContent) {
      console.log('⚠️  텍스트가 입력되지 않았습니다\n');
    } else {
      console.log(`✓ 텍스트 입력 확인: "${inputContent.textContent}"\n`);
    }

    // 7. 제출 버튼 클릭
    console.log('[TEST] Step 7: 제출 버튼 클릭\n');
    const submitSuccess = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) {
        console.log('[iframe] iframe 없음');
        return false;
      }

      let submitBtn = null;

      // 방법 1: 정확한 선택자 (form > .u_cbox_upload > button, 스티커 제외)
      const container = iframeDoc.querySelector('[id*="naverComment"]');
      if (container) {
        const uploadDiv = container.querySelector('form .u_cbox_upload > button');
        if (uploadDiv && !uploadDiv.className.includes('sticker')) {
          submitBtn = uploadDiv;
          console.log('[iframe] ✓ form 선택자로 등록 버튼 발견');
        }
      }

      // 방법 2: 폴백 - 모든 button 검색 (스티커 제외)
      if (!submitBtn) {
        const buttons = iframeDoc.querySelectorAll('button');
        console.log(`[iframe] button 검색 (${buttons.length}개, 스티커 제외)`);

        for (const btn of Array.from(buttons)) {
          const parent = btn.closest('[id*="naverComment"]');
          const className = btn.className || '';

          if (parent && className.includes('u_cbox_btn_upload') && !className.includes('sticker')) {
            submitBtn = btn;
            console.log('[iframe] ✓ 등록 버튼 발견 (스티커 제외)');
            break;
          }
        }
      }

      if (!submitBtn) {
        console.log('[iframe] 등록 버튼을 찾을 수 없습니다');
        return false;
      }

      try {
        submitBtn.click();
        console.log('[iframe] ✓ 등록 버튼 클릭 완료');
        return true;
      } catch (e) {
        console.log('[iframe] 등록 버튼 클릭 실패:', e);
        return false;
      }
    });

    if (!submitSuccess) {
      console.log('❌ 제출 실패\n');
      await browser.close();
      return;
    }

    console.log('✓ 제출 버튼 클릭 완료\n');

    // 8. 완료 대기
    console.log('[TEST] Step 8: 제출 완료 대기\n');
    await page.waitForTimeout(3000);

    console.log('✓ 테스트 완료\n');
    console.log('[TEST] ========== 결과 ==========\n');
    console.log('✅ 모든 단계가 성공했습니다!\n');
    console.log('- 로그인: ✓');
    console.log('- 글 페이지 이동: ✓');
    console.log('- 댓글 버튼 클릭: ✓');
    console.log('- naverComment 컨테이너 확인: ✓');
    console.log('- 댓글 입력: ✓');
    console.log('- 제출 버튼 클릭: ✓\n');
    console.log('⚠️  블로그를 새로고침하여 댓글이 실제로 달렸는지 확인해주세요.\n');

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testFullFlow().catch(console.error);
