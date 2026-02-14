const { chromium } = require('playwright');

async function analyzeNaverCommentStructure() {
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
    console.log('[TEST] 댓글 버튼 클릭...\n');
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

    // naverComment 컨테이너 상세 분석
    console.log('[TEST] === naverComment 컨테이너 상세 분석 ===\n');

    const containerAnalysis = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      // 메인 naverComment 컨테이너 찾기
      const mainContainer = iframeDoc.querySelector('div#naverComment_201_224183679576');
      if (!mainContainer) return { error: 'naverComment_201_224183679576 컨테이너 없음' };

      // 컨테이너 내부의 모든 요소 분석
      const writeWrap = mainContainer.querySelector('.u_cbox_write_wrap');
      const writeBox = mainContainer.querySelector('.u_cbox_write_box');
      const writeArea = mainContainer.querySelector('.u_cbox_write_area');

      // 댓글 입력 관련 요소들
      const contentEditable = mainContainer.querySelector('[contenteditable]');
      const inputElements = mainContainer.querySelectorAll('input');
      const textareaElements = mainContainer.querySelectorAll('textarea');

      // 숨겨진 div들 중에 contenteditable이 있을 수 있음
      const allDivs = Array.from(mainContainer.querySelectorAll('div'));
      const contentEditableDivs = allDivs.filter(div => div.contentEditable === 'true' || div.getAttribute('contenteditable'));

      // 버튼 찾기
      const submitBtn = mainContainer.querySelector('button.u_cbox_btn_upload');
      const buttons = mainContainer.querySelectorAll('button');

      // 텍스트 입력 필드 분석 (input[type="text"], contenteditable div 등)
      const textInputs = [];
      inputElements.forEach((input, idx) => {
        if (input.offsetHeight > 0 || input.offsetWidth > 0) {
          textInputs.push({
            type: 'input',
            id: input.id,
            name: input.name,
            inputType: input.type,
            placeholder: input.placeholder,
            visible: input.offsetHeight > 0,
          });
        }
      });

      contentEditableDivs.forEach((div, idx) => {
        if (idx < 5) {
          textInputs.push({
            type: 'contenteditable_div',
            id: div.id,
            class: div.className,
            visible: div.offsetHeight > 0,
            content: div.textContent?.substring(0, 50),
          });
        }
      });

      return {
        containerFound: !!mainContainer,
        containerClass: mainContainer?.className,
        writeWrapFound: !!writeWrap,
        writeBoxFound: !!writeBox,
        writeAreaFound: !!writeArea,
        contentEditableFound: !!contentEditable,
        textInputFields: textInputs,
        totalInputElements: inputElements.length,
        totalTextareaElements: textareaElements.length,
        totalButtons: buttons.length,
        submitButtonFound: !!submitBtn,
        submitButtonVisible: submitBtn?.offsetHeight > 0,
        submitButtonClass: submitBtn?.className,
      };
    });

    console.log(JSON.stringify(containerAnalysis, null, 2));

    // 더 깊은 분석: 실제 입력 가능한 요소 찾기
    console.log('\n[TEST] === 입력 가능한 요소 상세 분석 ===\n');

    const inputFieldAnalysis = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return { error: 'iframe 없음' };

      const mainContainer = iframeDoc.querySelector('div#naverComment_201_224183679576');
      if (!mainContainer) return { error: '컨테이너 없음' };

      // 방법 1: contenteditable="true"인 div 찾기
      const editableDivs = mainContainer.querySelectorAll('[contenteditable="true"]');
      const editableDivAnalysis = [];
      editableDivs.forEach((div, idx) => {
        editableDivAnalysis.push({
          index: idx,
          id: div.id,
          class: div.className,
          role: div.getAttribute('role'),
          ariaLabel: div.getAttribute('aria-label'),
          visible: div.offsetHeight > 0,
          height: div.offsetHeight,
          textContent: div.textContent?.substring(0, 100),
        });
      });

      // 방법 2: type="text"인 input 찾기
      const textInputs = mainContainer.querySelectorAll('input[type="text"], input:not([type])');
      const textInputAnalysis = [];
      textInputs.forEach((input, idx) => {
        if (idx < 10) {
          textInputAnalysis.push({
            index: idx,
            id: input.id,
            name: input.name,
            class: input.className,
            placeholder: input.placeholder,
            visible: input.offsetHeight > 0,
            value: input.value,
          });
        }
      });

      // 방법 3: u_cbox_write_area 안의 모든 요소
      const writeArea = mainContainer.querySelector('.u_cbox_write_area');
      let writeAreaContent = null;
      if (writeArea) {
        writeAreaContent = {
          tag: writeArea.tagName,
          class: writeArea.className,
          visible: writeArea.offsetHeight > 0,
          height: writeArea.offsetHeight,
          childrenCount: writeArea.children.length,
          children: Array.from(writeArea.children).slice(0, 5).map((child, idx) => ({
            index: idx,
            tag: child.tagName,
            id: child.id,
            class: child.className,
            visible: child.offsetHeight > 0,
          })),
        };
      }

      return {
        editableDivs: editableDivAnalysis,
        textInputs: textInputAnalysis,
        writeArea: writeAreaContent,
      };
    });

    console.log(JSON.stringify(inputFieldAnalysis, null, 2));

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

analyzeNaverCommentStructure().catch(console.error);
