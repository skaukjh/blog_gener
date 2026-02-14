const { chromium } = require('playwright');

async function testCommentWithManualLogin() {
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
    // 1단계: 로그인 페이지로 이동
    console.log('\n[TEST] === 로그인 시작 ===\n');
    console.log('[TEST] 로그인 페이지로 이동...');
    await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 2단계: ID/비밀번호 자동 입력
    console.log('[TEST] 로그인 정보 입력...');

    const idField = await page.$('input#id');
    if (!idField) {
      console.log('❌ ID 입력 필드를 찾을 수 없습니다');
      await browser.close();
      return;
    }

    await idField.fill(blogId);
    console.log(`✓ ID 입력: ${blogId}`);

    const pwField = await page.$('input#pw');
    if (!pwField) {
      console.log('❌ 비밀번호 입력 필드를 찾을 수 없습니다');
      await browser.close();
      return;
    }

    await pwField.fill(blogPassword);
    console.log('✓ 비밀번호 입력');

    // 3단계: 로그인 버튼 클릭
    const loginBtn = await page.$('button.btn_login');
    if (!loginBtn) {
      console.log('❌ 로그인 버튼을 찾을 수 없습니다');
      await browser.close();
      return;
    }

    console.log('[TEST] 로그인 버튼 클릭...');
    await loginBtn.click();

    // 4단계: 2차 인증 대기 (수동)
    console.log('\n[TEST] === 2차 인증 진행 중 ===\n');
    console.log('⏳ 브라우저 창에서 2차 인증을 완료해주세요.');
    console.log('⏳ 완료 후 로그인이 자동으로 진행됩니다...\n');

    // URL이 변경될 때까지 대기 (최대 60초)
    let loginComplete = false;
    let waitCount = 0;

    while (!loginComplete && waitCount < 60) {
      await page.waitForTimeout(1000);
      waitCount++;

      const currentUrl = page.url();

      // 로그인 완료 판정: 로그인 페이지가 아닐 때
      if (!currentUrl.includes('nid.naver.com/nidlogin')) {
        console.log(`✓ 로그인 완료 (${waitCount}초)`);
        loginComplete = true;
      }

      // 진행 상황 표시
      if (waitCount % 5 === 0) {
        console.log(`⏳ ${waitCount}초 경과...`);
      }
    }

    if (!loginComplete) {
      console.log('❌ 로그인 타임아웃 (60초)');
      await browser.close();
      return;
    }

    await page.waitForTimeout(2000);

    // 5단계: 블로그 글 페이지로 이동
    console.log('\n[TEST] === 글 페이지 접속 ===\n');
    console.log('[TEST] 글 페이지로 이동...');
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 6단계: 댓글 클릭 전 상태 확인
    console.log('[TEST] === 댓글 버튼 클릭 전 상태 ===\n');

    const beforeClick = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      let btnCommentFound = false;
      if (iframeDoc) {
        btnCommentFound = !!iframeDoc.querySelector('#btn_comment_2');
      }

      return {
        iframeFound: !!iframe,
        btnCommentFound: btnCommentFound,
        naverCommentCount: document.querySelectorAll('[id*="naverComment"]').length,
      };
    });

    console.log('[BEFORE CLICK]', JSON.stringify(beforeClick, null, 2));

    // 7단계: 댓글 버튼 클릭
    console.log('\n[TEST] 댓글 버튼 클릭 중...');

    const btnClicked = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) {
        console.log('[iframe] iframe 없음');
        return false;
      }

      // btn_comment_2 ID로 직접 찾기
      const commentBtn = iframeDoc.getElementById('btn_comment_2');
      if (!commentBtn) {
        console.log('[iframe] btn_comment_2 버튼 없음');
        return false;
      }

      console.log('[iframe] btn_comment_2 버튼 발견, 클릭 중...');
      commentBtn.click();
      console.log('[iframe] 클릭 완료');
      return true;
    });

    if (!btnClicked) {
      console.log('❌ 버튼 클릭 실패');
      await browser.close();
      return;
    }

    console.log('✓ 버튼 클릭 완료');

    // 8단계: 클릭 후 UI 변화 관찰
    console.log('\n[TEST] === 클릭 후 UI 변화 관찰 ===\n');

    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);

      const afterClick = await page.evaluate((timeNum) => {
        // 메인 페이지 상태
        const naverCommentContainers = document.querySelectorAll('[id*="naverComment"]');
        const textareas = document.querySelectorAll('textarea');
        const inputs = document.querySelectorAll('input');

        // iframe 상태도 함께 확인
        const iframe = document.querySelector('iframe#mainFrame');
        const iframeDoc = iframe?.contentDocument;

        let iframeTextarea = 0;
        let iframeInputs = 0;
        let iframeNaver = 0;

        if (iframeDoc) {
          iframeTextarea = iframeDoc.querySelectorAll('textarea').length;
          iframeInputs = iframeDoc.querySelectorAll('input').length;
          iframeNaver = iframeDoc.querySelectorAll('[id*="naverComment"]').length;
        }

        return {
          time: timeNum,
          mainPage: {
            naverCommentCount: naverCommentContainers.length,
            textareaCount: textareas.length,
            inputCount: inputs.length,
          },
          iframe: {
            textareaCount: iframeTextarea,
            inputCount: iframeInputs,
            naverCommentCount: iframeNaver,
          },
        };
      }, i + 1);

      console.log(`[${i + 1}초 후]:`, JSON.stringify(afterClick, null, 2));
    }

    // 9단계: 최종 상세 분석
    console.log('\n[TEST] === 최종 상세 분석 (comment 관련 요소) ===\n');

    const finalAnalysis = await page.evaluate(() => {
      // iframe 내부 분석
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;

      if (!iframeDoc) return { error: 'iframe contentDocument 없음' };

      // naverComment 컨테이너 찾기
      const naverCommentContainers = Array.from(iframeDoc.querySelectorAll('[id*="naverComment"]'));

      const containerAnalysis = naverCommentContainers.slice(0, 5).map((container, idx) => ({
        index: idx,
        id: container.id,
        tag: container.tagName,
        class: container.className,
        visible: container.offsetHeight > 0,
        hasTextarea: !!container.querySelector('textarea'),
        hasInput: !!container.querySelector('input'),
        hasButton: !!container.querySelector('button'),
      }));

      // textarea들 찾기
      const textareas = Array.from(iframeDoc.querySelectorAll('textarea'));
      const textareaAnalysis = textareas.slice(0, 5).map((ta, idx) => ({
        index: idx,
        id: ta.id,
        name: ta.name,
        class: ta.className,
        visible: ta.offsetHeight > 0,
        placeholder: ta.placeholder,
      }));

      // 제출 버튼 찾기
      const buttons = Array.from(iframeDoc.querySelectorAll('button'));
      const commentButtons = buttons.filter((btn) => {
        const text = btn.textContent?.toLowerCase() || '';
        const parent = btn.closest('[id*="naverComment"]');
        return parent && (text.includes('등록') || text.includes('댓글'));
      });

      const buttonAnalysis = commentButtons.slice(0, 5).map((btn, idx) => ({
        index: idx,
        text: btn.textContent?.trim().substring(0, 30),
        type: btn.type,
        class: btn.className,
        visible: btn.offsetHeight > 0,
      }));

      return {
        naverCommentContainersCount: naverCommentContainers.length,
        containers: containerAnalysis,
        textareasCount: textareas.length,
        textareas: textareaAnalysis,
        submitButtonsCount: commentButtons.length,
        buttons: buttonAnalysis,
      };
    });

    console.log(JSON.stringify(finalAnalysis, null, 2));

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testCommentWithManualLogin().catch(console.error);
