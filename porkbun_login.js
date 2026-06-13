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

  // Accept cookies first
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

  // Take screenshot to see the state
  await page.screenshot({ path: '/tmp/porkbun_before_captcha.png' });
  console.log('Screenshot saved');

  // Try to find and interact with the CAPTCHA
  // Cloudflare Turnstile is usually in an iframe
  const frames = page.frames();
  console.log('Number of frames:', frames.length);
  for (const frame of frames) {
    console.log('Frame URL:', frame.url().substring(0, 100));
  }

  // Look for turnstile iframe
  const turnstileFrame = page.frames().find(f => f.url().includes('turnstile') || f.url().includes('challenges.cloudflare'));
  if (turnstileFrame) {
    console.log('Found Turnstile frame:', turnstileFrame.url());
    const frameInputs = await turnstileFrame.locator('input, button, checkbox').all();
    for (const inp of frameInputs) {
      const tag = await inp.evaluate(el => el.tagName);
      const type = await inp.getAttribute('type').catch(() => '');
      console.log('Turnstile element:', tag, type);
    }
  }

  // Try clicking the captcha checkbox area
  try {
    // The pork captcha area
    const captchaArea = page.locator('#porkcaptcha-token_accountLogin');
    console.log('Captcha token element found:', await captchaArea.isVisible().catch(() => false));
  } catch(e) {}

  // Check the current captcha token value
  const captchaToken = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
  console.log('Captcha token value:', captchaToken ? 'has value (length: ' + captchaToken.length + ')' : 'empty');

  await page.screenshot({ path: '/tmp/porkbun_form_filled.png' });
  console.log('Form filled screenshot saved');

  // Wait and check if captcha might auto-solve
  await page.waitForTimeout(10000);
  const captchaToken2 = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
  console.log('Captcha token after wait:', captchaToken2 ? 'has value (length: ' + captchaToken2.length + ')' : 'empty');

  await browser.close();
})();
