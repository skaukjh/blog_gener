import puppeteer from 'puppeteer';

(async () => {
  console.log('네이버 블로그 크롤러 테스트 시작...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('📍 블로그 페이지 접근 중...');
    await page.goto('https://blog.naver.com/ssyeonee27', { waitUntil: 'networkidle2' });

    // 자바스크립트 렌더링 대기
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));

    // 페이지 HTML 분석
    const html = await page.content();

    // 모든 링크 추출
    const links = await page.evaluate(() => {
      const items = [];

      // 모든 a 태그 확인
      document.querySelectorAll('a[href*="Post"]').forEach((link) => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        if (href && text && text.length > 5) {
          items.push({ href, text: text.substring(0, 50) });
        }
      });

      return items;
    });

    console.log('\n📝 찾은 링크들:');
    links.slice(0, 10).forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" → ${link.href}`);
    });

    // DOM 구조 분석
    const structure = await page.evaluate(() => {
      const info = {
        title: document.title,
        hasPostView: !!document.querySelector('a[href*="PostView"]'),
        hasLogNo: !!document.querySelector('a[href*="logNo"]'),
        hasArticleTag: document.querySelectorAll('article').length,
        allLinks: document.querySelectorAll('a').length,
        bodyText: document.body.innerText.substring(0, 200),
      };

      // 모든 a 태그의 href 패턴 추출
      const hrefPatterns = new Set();
      document.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href');
        if (href && href.includes('naver.com')) {
          // 패턴만 추출
          const match = href.match(/\/([^?/]+)/);
          if (match) hrefPatterns.add(match[1]);
        }
      });

      info.hrefPatterns = Array.from(hrefPatterns).slice(0, 10);

      return info;
    });

    console.log('\n🔍 페이지 구조 정보:');
    console.log(`- 제목: ${structure.title}`);
    console.log(`- PostView 링크 있음: ${structure.hasPostView}`);
    console.log(`- logNo 링크 있음: ${structure.hasLogNo}`);
    console.log(`- article 태그: ${structure.hasArticleTag}개`);
    console.log(`- 총 a 태그: ${structure.allLinks}개`);
    console.log(`- href 패턴들: ${structure.hrefPatterns.join(', ')}`);

  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ 테스트 완료');
  }
})();
