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

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('porkbun.com/api') || url.includes('porkbun.com/account/login')) {
      if (url.includes('porkbun.com/api')) {
        try {
          const text = await response.text().catch(() => '');
          console.log('API:', url.substring(0, 80), '->', text.substring(0, 300));
        } catch(e) {}
      }
    }
  });

  await page.goto('https://porkbun.com/account/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Accept cookies
  try {
    const acceptBtn = page.locator('button:has-text("Accept All")');
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch(e) {}

  // Fill login
  await page.fill('#loginUsername', 'helpsona.support@gmail.com');
  await page.fill('#loginPassword', '*R^,6Nc($8H7T*X');
  console.log('Filled credentials');

  // Click CAPTCHA checkbox
  const porkCaptcha = page.locator('#my-porkcaptcha_accountLogin');
  const box = await porkCaptcha.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 28, box.y + box.height / 2);
    console.log('Clicked captcha checkbox');
    await page.waitForTimeout(15000);
  }

  // Check captcha solved
  const porkToken = await page.locator('#porkcaptcha-token_accountLogin').inputValue().catch(() => '');
  console.log('Captcha token:', porkToken ? 'SOLVED (len=' + porkToken.length + ')' : 'NOT SOLVED');

  if (!porkToken) {
    console.log('ERROR: Captcha not solved');
    await browser.close();
    return;
  }

  // Now try to find and click the Login button properly
  // First, let's find the exact Login button
  const buttons = await page.locator('button').all();
  for (const btn of buttons) {
    const text = await btn.innerText().catch(() => '');
    const visible = await btn.isVisible().catch(() => false);
    const enabled = await btn.isEnabled().catch(() => false);
    if (text.includes('Login') || text.includes('log') || text.includes('submit')) {
      console.log(`Button: "${text}" visible=${visible} enabled=${enabled}`);
    }
  }

  // Find the specific login button
  const loginBtn = page.locator('#loginButton, button:has-text("Login"):not(:has-text("Create"))').first();
  const loginBtnVisible = await loginBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Login button visible:', loginBtnVisible);

  // Try clicking
  await loginBtn.click();
  console.log('Clicked Login button');

  // Wait for navigation or response
  await page.waitForTimeout(15000);
  
  const currentUrl = page.url();
  console.log('URL after login attempt:', currentUrl);
  
  // Check page content for errors or success
  const bodyText = await page.innerText('body').catch(() => '');
  console.log('Body text (first 800):', bodyText.substring(0, 800));

  await page.screenshot({ path: '/tmp/porkbun_login_debug.png' });

  // Check session info
  const sessionResp = await page.evaluate(async () => {
    const resp = await fetch('/api/user/sessionInfo');
    return await resp.text();
  });
  console.log('Session info:', sessionResp);

  await browser.close();
})();
