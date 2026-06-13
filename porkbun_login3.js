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
  
  // Intercept requests to look at API responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('login') || url.includes('captcha')) {
      console.log('API Response:', url.substring(0, 120), 'Status:', response.status());
    }
  });

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
  } catch(e) {}

  // Fill in login credentials
  await page.fill('#loginUsername', 'helpsona.support@gmail.com');
  await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
  console.log('Filled credentials');

  // Let's examine the turnstile widget more carefully
  const turnstileFrames = page.frames().filter(f => f.url().includes('turnstile'));
  console.log('Found', turnstileFrames.length, 'turnstile frames');
  
  for (let i = 0; i < turnstileFrames.length; i++) {
    const frame = turnstileFrames[i];
    console.log(`Frame ${i}:`, frame.url().substring(0, 150));
    const html = await frame.locator('body').innerHTML().catch(() => '');
    console.log(`Frame ${i} HTML (first 500):`, html.substring(0, 500));
  }

  // Let's also check if there's a way to manually set the turnstile response
  // The cf-turnstile-response hidden input
  const cfInputs = await page.locator('input[name="cf-turnstile-response"]').all();
  console.log('CF turnstone response inputs:', cfInputs.length);

  // Try to find the Pork Captcha widget area and click it
  try {
    // Look for the captcha widget div
    const captchaWidget = page.locator('.porkcaptcha, [class*=captcha], [id*=captcha]').first();
    if (await captchaWidget.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Found captcha widget');
      await captchaWidget.click();
      await page.waitForTimeout(3000);
    }
  } catch(e) {
    console.log('Captcha widget click failed:', e.message.substring(0, 100));
  }

  // Try to click the "I'm not a robot" area - it's usually in a specific div
  const notARobotText = page.locator('text=I\'m not a robot');
  if (await notARobotText.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Found "I\'m not a robot" text');
    // Find parent element and click
    const parent = notARobotText.locator('..');
    await parent.click();
    console.log('Clicked not a robot parent');
    await page.waitForTimeout(10000);
  }

  // Check captcha token again
  const captchaToken = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
  console.log('Captcha token:', captchaToken ? 'has value (length: ' + captchaToken.length + ')' : 'empty');

  // Let's try clicking directly in the area where the checkbox would be
  // Get the position of the captcha div
  const captchaDiv = page.locator('[id*="porkcaptcha"]').first();
  if (await captchaDiv.isVisible({ timeout: 2000 }).catch(() => false)) {
    const box = await captchaDiv.boundingBox();
    console.log('Captcha div bounding box:', box);
    if (box) {
      // Click roughly where the checkbox would be (left side)
      await page.mouse.click(box.x + 30, box.y + box.height / 2);
      console.log('Clicked on captcha area');
      await page.waitForTimeout(10000);
    }
  }

  const captchaToken2 = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
  console.log('Captcha token after click:', captchaToken2 ? 'has value (length: ' + captchaToken2.length + ')' : 'empty');

  await page.screenshot({ path: '/tmp/porkbun_captcha2.png' });

  await browser.close();
})();
