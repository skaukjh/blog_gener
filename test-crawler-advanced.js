import puppeteer from 'puppeteer';

(async () => {
  console.log('🚀 고급 크롤러 테스트 시작...');

  const browser = await puppeteer.launch({
    headless: false, // ✅ headless 비활성화 (네이버 감지 회피)
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();

    // Puppeteer 감지 회피
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // User-Agent 설정
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log('📍 블로그 페이지 접근 중...');
    await page.goto('https://blog.naver.com/ssyeonee27', {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // 더 오래 대기
    console.log('⏳ JavaScript 렌더링 대기 중...');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));

    // 추가 요소 로드 대기
    try {
      await page.waitForSelector('a[href*="Post"], a[href*="logNo"]', { timeout: 10000 });
      console.log('✅ 블로그 글 요소 발견!');
    } catch {
      console.log('⚠️ 특정 선택자 대기 시간 초과, 계속 진행...');
    }

    // 페이지 스크린샷
    await page.screenshot({ path: 'screenshot.png' });
    console.log('📸 스크린샷 저장됨: screenshot.png');

    // iframe 확인
    const iframes = await page.evaluate(() => {
      return document.querySelectorAll('iframe').length;
    });
    console.log(`📌 iframe 개수: ${iframes}`);

    // 모든 a 태그 추출 (다양한 방식)
    const allLinks = await page.evaluate(() => {
      const items = [];

      // 방식 1: 모든 a 태그
      document.querySelectorAll('a').forEach((link) => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        if (href && text && (text.length > 3 || href.includes('naver'))) {
          items.push({
            href: href.substring(0, 100),
            text: text.substring(0, 40),
            type: 'a-tag',
          });
        }
      });

      // 방식 2: onclick이 있는 요소들
      document.querySelectorAll('[onclick*="Post"], [onclick*="blog"]').forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length > 5) {
          items.push({
            href: el.getAttribute('onclick')?.substring(0, 50) || 'onclick',
            text: text.substring(0, 40),
            type: 'onclick',
          });
        }
      });

      return items.slice(0, 20);
    });

    console.log('\n📝 발견한 요소들:');
    if (allLinks.length === 0) {
      console.log('❌ 요소를 찾지 못했습니다');
    } else {
      allLinks.forEach((link, i) => {
        console.log(`${i + 1}. [${link.type}] "${link.text}" → ${link.href}`);
      });
    }

    // Body 텍스트의 처음 500자
    const bodyText = await page.evaluate(() => {
      return document.body.innerText.substring(0, 500);
    });
    console.log('\n📄 페이지 텍스트 샘플:');
    console.log(bodyText);

  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    // 5초 대기 후 종료 (스크린샷 확인용)
    await new Promise(resolve => setTimeout(resolve, 2000));
    await browser.close();
    console.log('\n✅ 테스트 완료');
  }
})();
