const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
  
  const page = await context.newPage();
  await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Accept cookies
  try {
    const acceptBtn = page.locator('button:has-text("Accept All")');
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      console.log('Accepted cookies');
      await page.waitForTimeout(1000);
    }
  } catch(e) {
    console.log('No cookie banner');
  }

  // Fill in login credentials
  await page.fill('#loginUsername', 'helpsona.support@gmail.com');
  console.log('Filled email');
  await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
  console.log('Filled password');

  // Try to click on the Turnstile captcha checkbox
  const turnstileFrame = page.frames().find(f => f.url().includes('turnstile') && f.url().includes('0x4AAAAAAA6GKaAgDPcUgP1q'));
  if (turnstileFrame) {
    console.log('Found Turnstile frame for captcha');
    try {
      // Try to find and click the checkbox in the turnstile iframe
      const checkbox = turnstileFrame.locator('#cf-turnstile-response, input[type=checkbox], .mark, button').first();
      const count = await checkbox.count();
      console.log('Found checkbox elements:', count);
      if (count > 0) {
        await checkbox.click();
        console.log('Clicked turnstile checkbox');
      }
    } catch(e) {
      console.log('Could not click turnstile checkbox:', e.message);
    }
    
    // Also try body click
    try {
      await turnstileFrame.locator('body').click();
      console.log('Clicked turnstile body');
    } catch(e) {}
  }

  // Wait for captcha to potentially solve
  await page.waitForTimeout(15000);
  
  const captchaToken = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
  console.log('Captcha token after click:', captchaToken ? 'has value (length: ' + captchaToken.length + ')' : 'empty');

  await page.screenshot({ path: '/tmp/porkbun_captcha_attempt.png' });

  // Try to use the "Use Cloudflare Captcha" link instead of the default one
  try {
    const cfLink = page.locator('text=Use Cloudflare Captcha');
    if (await cfLink.isVisible({ timeout: 3000 })) {
      await cfLink.click();
      console.log('Switched to Cloudflare Captcha');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/tmp/porkbun_cf_captcha.png' });
    }
  } catch(e) {
    console.log('No Cloudflare Captcha link');
  }

  await browser.close();
})();
