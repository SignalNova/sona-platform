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
  await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  
  const title = await page.title();
  console.log('Title:', title);
  
  const bodyText = await page.innerText('body').catch(() => 'no body text');
  console.log('Body text (first 500):', bodyText.substring(0, 500));
  
  // Check for captcha
  const captchaToken = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => 'not found');
  console.log('Captcha token:', captchaToken ? (captchaToken.length > 0 ? 'has value (length: ' + captchaToken.length + ')' : 'empty') : 'not found');

  await browser.close();
})();
