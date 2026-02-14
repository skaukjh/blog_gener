const { chromium } = require('playwright');

async function testCommentWithLogin() {
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

    // 2단계: ID/비밀번호 입력
    console.log('[TEST] 로그인 정보 입력...');

    // ID 입력 필드 찾기
    const idField = await page.$('input#id');
    if (!idField) {
      console.log('❌ ID 입력 필드를 찾을 수 없습니다');
      await browser.close();
      return;
    }

    await idField.fill(blogId);
    console.log(`✓ ID 입력: ${blogId}`);

    // 비밀번호 입력 필드 찾기
    const pwField = await page.$('input#pw');
    if (!pwField) {
      console.log('❌ 비밀번호 입력 필드를 찾을 수 없습니다');
      await browser.close();
      return;
    }

    await pwField.fill(blogPassword);
    console.log('✓ 비밀번호 입력');

    // 로그인 버튼 클릭
    const loginBtn = await page.$('button.btn_login');
    if (!loginBtn) {
      console.log('❌ 로그인 버튼을 찾을 수 없습니다');
      await browser.close();
      return;
    }

    console.log('[TEST] 로그인 버튼 클릭...');
    await loginBtn.click();

    // 로그인 완료 대기 (최대 10초)
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
      console.log('✓ 로그인 완료');
    } catch (err) {
      console.log('⚠️  로그인 페이지 로딩 타임아웃 (계속 진행)');
    }

    await page.waitForTimeout(2000);

    // 3단계: 글 페이지로 이동
    console.log('\n[TEST] === 글 페이지 접속 ===\n');
    console.log('[TEST] 글 페이지로 이동...');
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 4단계: 댓글 클릭 전 상태 확인
    console.log('[TEST] === 댓글 버튼 클릭 전 구조 ===\n');

    const beforeClick = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('[id*="naverComment"], [class*="comment"]'));
      return {
        naverCommentCount: document.querySelectorAll('[id*="naverComment"]').length,
        commentRelatedElements: containers.length,
        containerIds: containers.map(el => el.id).filter(Boolean).slice(0, 5),
      };
    });

    console.log('[BEFORE CLICK]', JSON.stringify(beforeClick, null, 2));

    // 5단계: 댓글 버튼 클릭
    console.log('\n[TEST] 댓글 버튼 클릭 중...');
    const btnClicked = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) {
        console.log('[iframe] iframe 없음');
        return false;
      }

      const commentArea = iframeDoc.querySelector('.area_comment');
      if (!commentArea) {
        console.log('[iframe] .area_comment 없음');
        return false;
      }

      console.log('[iframe] .area_comment 발견, 클릭 중...');
      const clickable = commentArea.querySelector('a, button, [onclick]') || commentArea;
      clickable.click();
      console.log('[iframe] 클릭 완료');
      return true;
    });

    if (!btnClicked) {
      console.log('❌ 버튼 클릭 실패');
      await browser.close();
      return;
    }

    console.log('✓ 버튼 클릭 완료');

    // 6단계: 클릭 후 UI 변화 관찰
    console.log('\n[TEST] === 클릭 후 UI 변화 관찰 ===\n');

    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);

      const afterClick = await page.evaluate((timeNum) => {
        // 메인 페이지 상태
        const naverCommentContainers = document.querySelectorAll('[id*="naverComment"]');
        const commentDivs = document.querySelectorAll('[class*="comment"], [class*="cbox"]');
        const textareas = document.querySelectorAll('textarea');
        const inputs = document.querySelectorAll('input');
        const allNewDivs = document.querySelectorAll('div[class*="write"], div[class*="cbox"]');

        // iframe 상태도 함께 확인
        const iframe = document.querySelector('iframe#mainFrame');
        const iframeDoc = iframe?.contentDocument;

        let iframeTextarea = 0;
        let iframeInputs = 0;
        if (iframeDoc) {
          iframeTextarea = iframeDoc.querySelectorAll('textarea').length;
          iframeInputs = iframeDoc.querySelectorAll('input').length;
        }

        return {
          time: timeNum,
          mainPage: {
            naverCommentCount: naverCommentContainers.length,
            commentDivCount: commentDivs.length,
            textareaCount: textareas.length,
            inputCount: inputs.length,
            newDivCount: allNewDivs.length,
          },
          iframe: {
            textareaCount: iframeTextarea,
            inputCount: iframeInputs,
          },
          naverCommentIds: Array.from(naverCommentContainers).map(el => el.id).slice(0, 3),
        };
      }, i + 1);

      console.log(`[${i + 1}초 후]:`, JSON.stringify(afterClick, null, 2));
    }

    // 7단계: 최종 상세 분석
    console.log('\n[TEST] === 최종 상세 분석 ===\n');

    const finalAnalysis = await page.evaluate(() => {
      // 메인 페이지
      const mainInputs = document.querySelectorAll('input, textarea');
      const mainButtons = document.querySelectorAll('button');

      const inputDetails = [];
      mainInputs.forEach((input, idx) => {
        if (inputDetails.length < 10) {
          inputDetails.push({
            index: idx,
            tag: input.tagName,
            id: input.id,
            name: input.name,
            class: input.className,
            visible: input.offsetHeight > 0,
            placeholder: input.placeholder || '',
          });
        }
      });

      const buttonDetails = [];
      mainButtons.forEach((btn, idx) => {
        if (buttonDetails.length < 10) {
          buttonDetails.push({
            index: idx,
            text: btn.textContent?.trim().substring(0, 30),
            type: btn.type,
            id: btn.id,
            class: btn.className,
            visible: btn.offsetHeight > 0,
          });
        }
      });

      // iframe 내부 분석
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      let iframeInputs = [];
      let iframeButtons = [];

      if (iframeDoc) {
        const iframeInputElements = iframeDoc.querySelectorAll('input, textarea');
        const iframeButtonElements = iframeDoc.querySelectorAll('button');

        iframeInputElements.forEach((input, idx) => {
          if (iframeInputs.length < 10) {
            iframeInputs.push({
              index: idx,
              tag: input.tagName,
              id: input.id,
              name: input.name,
              class: input.className,
              visible: input.offsetHeight > 0,
            });
          }
        });

        iframeButtonElements.forEach((btn, idx) => {
          if (iframeButtons.length < 10) {
            iframeButtons.push({
              index: idx,
              text: btn.textContent?.trim().substring(0, 30),
              class: btn.className,
              visible: btn.offsetHeight > 0,
            });
          }
        });
      }

      return {
        mainPage: {
          totalInputs: mainInputs.length,
          totalButtons: mainButtons.length,
          inputs: inputDetails,
          buttons: buttonDetails,
        },
        iframe: {
          totalInputs: iframeInputs.length,
          totalButtons: iframeButtons.length,
          inputs: iframeInputs,
          buttons: iframeButtons,
        },
      };
    });

    console.log(JSON.stringify(finalAnalysis, null, 2));

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testCommentWithLogin().catch(console.error);
