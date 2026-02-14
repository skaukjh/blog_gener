const { chromium } = require('playwright');

async function analyzeCommentStructure() {
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

    console.log('\n[TEST] === 댓글 구조 분석 시작 ===\n');

    // 1. iframe 구조 확인
    console.log('[TEST] 1️⃣  iframe 구조 확인:');
    const iframeInfo = await page.evaluate(() => {
      const iframe = document.querySelector('iframe#mainFrame');
      return {
        iframeFound: !!iframe,
        iframeId: iframe?.id,
        iframeClass: iframe?.className,
      };
    });
    console.log('   결과:', JSON.stringify(iframeInfo, null, 2));

    // 2. iframe 내부의 댓글 버튼 구조
    if (iframeInfo.iframeFound) {
      console.log('\n[TEST] 2️⃣  iframe 내부 댓글 버튼:');
      const btnStructure = await page.evaluate(() => {
        const iframe = document.querySelector('iframe#mainFrame');
        const iframeDoc = iframe?.contentDocument;
        if (!iframeDoc) return { error: 'iframe contentDocument 없음' };

        // 사용자가 제시한 선택자
        const commentBtn = iframeDoc.querySelector(
          '#printPost1 > tbody > tr > td.bcc > div.post-btn.post_btn2 > div.wrap_postcomment > div.area_comment.pcol3'
        );

        // 대체 선택자들 시도
        const alternatives = [
          { name: '.area_comment', selector: '.area_comment' },
          { name: '.wrap_postcomment', selector: '.wrap_postcomment' },
          { name: '.post_btn2', selector: '.post_btn2' },
          { name: 'div with class containing comment', selector: 'div[class*="comment"]' },
        ];

        const foundAlternatives = {};
        for (const alt of alternatives) {
          const found = iframeDoc.querySelector(alt.selector);
          if (found) {
            foundAlternatives[alt.name] = {
              found: true,
              tag: found.tagName,
              class: found.className,
              text: found.textContent?.trim().substring(0, 50),
            };
          }
        }

        return {
          commentButtonFound: !!commentBtn,
          commentButtonTag: commentBtn?.tagName,
          commentButtonClass: commentBtn?.className,
          commentButtonText: commentBtn?.textContent?.trim().substring(0, 100),
          alternatives: foundAlternatives,
        };
      });
      console.log('   결과:', JSON.stringify(btnStructure, null, 2));
    }

    // 3. 메인 페이지의 댓글 관련 요소
    console.log('\n[TEST] 3️⃣  메인 페이지 댓글 입력창:');
    const commentInputInfo = await page.evaluate(() => {
      // naverComment 컨테이너 찾기
      const containers = document.querySelectorAll('[id*="naverComment"]');

      const containerDetails = [];
      containers.forEach((container, idx) => {
        const id = container.id;
        const writeWrap = container.querySelector('.u_cbox_write_wrap');
        const writeBox = container.querySelector('.u_cbox_write_box');
        const textArea = container.querySelector('textarea');
        const submitBtn = container.querySelector('button[type="submit"]');

        containerDetails.push({
          index: idx,
          id: id,
          hasWriteWrap: !!writeWrap,
          hasWriteBox: !!writeBox,
          hasTextArea: !!textArea,
          hasSubmitBtn: !!submitBtn,
        });
      });

      return {
        naverCommentContainerCount: containers.length,
        containerDetails: containerDetails.slice(0, 2),
      };
    });
    console.log('   결과:', JSON.stringify(commentInputInfo, null, 2));

    // 4. 댓글 제출 버튼 찾기
    console.log('\n[TEST] 4️⃣  댓글 제출 버튼:');
    const submitBtnInfo = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const commentSubmitBtns = Array.from(buttons).filter((btn) => {
        const parent = btn.closest('[id*="naverComment"]');
        const text = btn.textContent?.toLowerCase() || '';
        return !!parent && (text.includes('등록') || text.includes('댓글'));
      });

      return {
        totalButtons: buttons.length,
        commentSubmitBtnCount: commentSubmitBtns.length,
        firstSubmitBtn: commentSubmitBtns.length > 0 ? {
          tag: commentSubmitBtns[0].tagName,
          class: commentSubmitBtns[0].className,
          text: commentSubmitBtns[0].textContent?.trim(),
          type: commentSubmitBtns[0].type,
        } : null,
      };
    });
    console.log('   결과:', JSON.stringify(submitBtnInfo, null, 2));

    console.log('\n[TEST] === 댓글 구조 분석 완료 ===\n');

  } catch (error) {
    console.error('[TEST] 오류:', error);
  } finally {
    await browser.close();
  }
}

analyzeCommentStructure().catch(console.error);
