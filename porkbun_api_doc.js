const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({ 
    headless: true
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  // Try to access the Porkbun API documentation
  await page.goto('https://porkbun.com/api/json/v3/documentation', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  const bodyText = await page.innerText('body').catch(() => '');
  console.log('API docs (first 3000):', bodyText.substring(0, 3000));

  await browser.close();
})();
