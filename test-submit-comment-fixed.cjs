const { chromium } = require('playwright');

async function testSubmitCommentFixed() {
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

    // Step 2: 개선된 컨테이너 감지 (u_cbox 클래스 확인)
    console.log('[TEST] === Step 2: 실제 나버코멘트 컨테이너 감지 ===\n');
    let containerReady = false;
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(100);

      const checkResult = await page.evaluate(() => {
        const iframe = document.querySelector('iframe#mainFrame');
        const iframeDoc = iframe?.contentDocument;

        if (iframeDoc) {
          // ✓ 수정: div[id*="naverComment"] AND class*="u_cbox"만 매칭
          const container = iframeDoc.querySelector('div[id*="naverComment"][class*="u_cbox"]');
          if (container) {
            console.log(`[evaluate] ✓ iframe 내부에서 실제 컨테이너 발견: ${container.id}`);
            return { found: true, location: 'iframe', id: container.id, tag: container.tagName };
          }

          // 폴백: 모든 naverComment div 확인
          const allContainers = iframeDoc.querySelectorAll('div[id*="naverComment"]');
          if (allContainers.length > 0) {
            console.log(`[evaluate] iframe에서 ${allContainers.length}개 div[id*="naverComment"] 발견 (u_cbox 클래스 확인)`);
            for (const el of Array.from(allContainers)) {
              const hasUcbox = el.className?.includes('u_cbox');
              console.log(`[evaluate]   - ${el.id}: u_cbox=${hasUcbox}`);
            }
          }
        }

        return { found: false, location: '', id: '', tag: '' };
      });

      if (checkResult.found) {
        containerReady = true;
        console.log(`✓ 댓글 입력창 준비됨 (위치: ${checkResult.location}, ID: ${checkResult.id}, 태그: ${checkResult.tag})\n`);
        break;
      }
    }

    if (!containerReady) {
      console.log('❌ 댓글 입력창 시간 초과\n');
      await browser.close();
      return;
    }

    // Step 3: 개선된 contenteditable 검색
    console.log('[TEST] === Step 3: contenteditable div 검색 및 입력 ===\n');
    const inputResult = await page.evaluate((comment) => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      if (iframeDoc) {
        // Method 1: ID 기반
        const editableDiv = iframeDoc.querySelector('[id*="naverComment"][id*="write_textarea"]');
        if (editableDiv && editableDiv.contentEditable === 'true') {
          console.log('[evaluate] Method 1: ID 기반 contenteditable 발견');
          editableDiv.focus();
          editableDiv.textContent = comment;
          editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
          editableDiv.dispatchEvent(new Event('change', { bubbles: true }));
          editableDiv.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          return {
            success: true,
            location: 'iframe/id-selector',
            divId: editableDiv.id,
            textContent: editableDiv.textContent
          };
        }

        // Method 2: u_cbox_write_area 내부
        const container = iframeDoc.querySelector('div[id*="naverComment"][class*="u_cbox"]');
        if (container) {
          const writeArea = container.querySelector('.u_cbox_write_area');
          if (writeArea) {
            const editableDivs = writeArea.querySelectorAll('div[contenteditable="true"]');
            console.log(`[evaluate] u_cbox_write_area 내부 contenteditable div: ${editableDivs.length}개`);
            if (editableDivs.length > 0) {
              const div = editableDivs[0];
              console.log('[evaluate] Method 2: u_cbox_write_area 내부에서 발견');
              div.focus();
              div.textContent = comment;
              div.dispatchEvent(new Event('input', { bubbles: true }));
              div.dispatchEvent(new Event('change', { bubbles: true }));
              div.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
              return {
                success: true,
                location: 'iframe/write-area-search',
                divId: div.id,
                textContent: div.textContent
              };
            }
          }
        }

        // Method 3: 모든 contenteditable 검색
        const editableDivs = iframeDoc.querySelectorAll('div[contenteditable="true"]');
        console.log(`[evaluate] iframe 전체 contenteditable div: ${editableDivs.length}개`);
        for (const div of Array.from(editableDivs)) {
          const parent = div.closest('[id*="naverComment"]');
          if (parent) {
            console.log(`[evaluate] Method 3: naverComment 내부 contenteditable 발견: ${div.id}`);
            div.focus();
            div.textContent = comment;
            div.dispatchEvent(new Event('input', { bubbles: true }));
            div.dispatchEvent(new Event('change', { bubbles: true }));
            div.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            return {
              success: true,
              location: 'iframe/fallback-search',
              divId: div.id,
              textContent: div.textContent
            };
          }
        }
      }

      // 최종 디버그
      const debugInfo = {
        iframe: !!iframeDoc,
        containers: iframeDoc?.querySelectorAll('[id*="naverComment"]').length || 0,
        writeAreas: iframeDoc?.querySelectorAll('.u_cbox_write_area').length || 0,
        editableDivs: iframeDoc?.querySelectorAll('div[contenteditable="true"]').length || 0,
      };
      console.log(`[evaluate] 입력 필드 미발견 - 디버그:`, JSON.stringify(debugInfo));

      return { success: false, location: '', reason: '입력 필드를 찾을 수 없습니다', divId: '' };
    }, testComment);

    console.log('Step 3 결과:');
    console.log(JSON.stringify(inputResult, null, 2));
    console.log();

    if (!inputResult.success) {
      console.log(`❌ 댓글 입력 실패: ${inputResult.reason}`);
      await browser.close();
      return;
    }

    console.log(`✓ 댓글 입력 성공 (위치: ${inputResult.location}, 텍스트: "${inputResult.textContent}")\n`);

    // Step 4: 제출 버튼 찾기
    console.log('[TEST] === Step 4: 제출 버튼 클릭 ===\n');
    const submitSuccess = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) {
        console.log('[evaluate] iframe 없음');
        return false;
      }

      const buttons = iframeDoc.querySelectorAll('button');
      console.log(`[evaluate] 발견된 button 개수: ${buttons.length}`);

      for (const btn of Array.from(buttons)) {
        const parent = btn.closest('[id*="naverComment"]');
        const text = btn.textContent?.toLowerCase() || '';
        const className = btn.className || '';

        if (parent && (text.includes('등록') || className.includes('u_cbox_btn_upload'))) {
          console.log(`[evaluate] ✓ 제출 버튼 발견: "${text.trim()}"`);
          btn.click();
          return true;
        }
      }

      console.log('[evaluate] ❌ 제출 버튼을 찾을 수 없습니다');
      return false;
    });

    if (!submitSuccess) {
      console.log('❌ 제출 버튼 클릭 실패\n');
      await browser.close();
      return;
    }

    console.log('✓ 제출 버튼 클릭 완료\n');

    // 완료 대기
    console.log('[TEST] === Step 5: 제출 완료 대기 ===\n');
    await page.waitForTimeout(3000);

    console.log('✅ 테스트 완료!\n');
    console.log('모든 단계 결과:');
    console.log('- Step 1 (댓글 버튼): ✓');
    console.log('- Step 2 (컨테이너 감지): ✓');
    console.log('- Step 3 (입력): ✓');
    console.log('- Step 4 (제출): ✓');
    console.log('- Step 5 (완료): ✓\n');

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testSubmitCommentFixed().catch(console.error);
