const { chromium } = require('playwright');

async function testCommentClick() {
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
    console.log('\n[TEST] 글 페이지 접속...');
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log('[TEST] === 댓글 버튼 클릭 전 구조 ===\n');

    // 클릭 전: naverComment 컨테이너 확인
    const beforeClick = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('[id*="naverComment"], [class*="comment"]'));
      return {
        naverCommentCount: document.querySelectorAll('[id*="naverComment"]').length,
        commentRelatedElements: containers.length,
        containerIds: containers.map(el => el.id).filter(Boolean).slice(0, 5),
      };
    });

    console.log('[BEFORE CLICK]', JSON.stringify(beforeClick, null, 2));

    // 댓글 버튼 클릭
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

    // 클릭 후 UI 변화 관찰 (1초마다 5번)
    console.log('\n[TEST] === 클릭 후 UI 변화 관찰 ===\n');

    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);

      const afterClick = await page.evaluate((timeNum) => {
        // 1. naverComment 컨테이너
        const naverCommentContainers = document.querySelectorAll('[id*="naverComment"]');

        // 2. 댓글 관련 div들
        const commentDivs = document.querySelectorAll('[class*="comment"], [class*="cbox"]');

        // 3. textarea
        const textareas = document.querySelectorAll('textarea');

        // 4. 새로 나타난 요소들
        const allNewDivs = document.querySelectorAll('div[class*="write"], div[class*="cbox"]');

        return {
          time: timeNum,
          naverCommentCount: naverCommentContainers.length,
          commentDivCount: commentDivs.length,
          textareaCount: textareas.length,
          newDivCount: allNewDivs.length,
          naverCommentIds: Array.from(naverCommentContainers).map(el => el.id).slice(0, 3),
          classes: Array.from(allNewDivs).map(el => el.className).filter(Boolean).slice(0, 5),
        };
      }, i + 1);

      console.log(`[${i + 1}초 후]:`, JSON.stringify(afterClick, null, 2));
    }

    // 최종 상세 분석
    console.log('\n[TEST] === 최종 상세 분석 ===\n');

    const finalAnalysis = await page.evaluate(() => {
      // 모든 input, textarea 찾기
      const inputs = document.querySelectorAll('input, textarea');
      const inputDetails = [];

      inputs.forEach((input, idx) => {
        if (inputDetails.length < 5) {
          inputDetails.push({
            index: idx,
            tag: input.tagName,
            id: input.id,
            name: input.name,
            class: input.className,
            visible: input.offsetHeight > 0,
          });
        }
      });

      // 모든 버튼 찾기
      const buttons = document.querySelectorAll('button');
      const buttonDetails = [];

      buttons.forEach((btn, idx) => {
        if (buttonDetails.length < 5) {
          buttonDetails.push({
            index: idx,
            text: btn.textContent?.trim().substring(0, 20),
            type: btn.type,
            id: btn.id,
            class: btn.className,
            visible: btn.offsetHeight > 0,
          });
        }
      });

      // iframe 내부 상태
      const iframe = document.querySelector('iframe#mainFrame');
      const iframeDoc = iframe?.contentDocument;
      const iframeArea = iframeDoc ? {
        areaComment: !!iframeDoc.querySelector('.area_comment'),
        areaCommentText: iframeDoc.querySelector('.area_comment')?.textContent?.trim().substring(0, 30),
      } : null;

      return {
        totalInputs: inputs.length,
        totalButtons: buttons.length,
        inputDetails,
        buttonDetails,
        iframeArea,
      };
    });

    console.log(JSON.stringify(finalAnalysis, null, 2));

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

testCommentClick().catch(console.error);
