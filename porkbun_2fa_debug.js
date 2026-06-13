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

  // Click CAPTCHA checkbox
  const porkCaptcha = page.locator('#my-porkcaptcha_accountLogin');
  const box = await porkCaptcha.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 28, box.y + box.height / 2);
    await page.waitForTimeout(15000);
  }

  // Check "Remember me for 30 days"
  try {
    const rememberMe = page.locator('#rememberMe');
    if (await rememberMe.isVisible({ timeout: 2000 })) {
      await rememberMe.check();
      console.log('Checked Remember me');
    }
  } catch(e) {
    console.log('Remember me not found');
  }

  // Click Login
  const loginBtn = page.locator('button:has-text("Login")').first();
  await loginBtn.click();
  await page.waitForTimeout(8000);
  
  console.log('URL after login:', page.url());
  
  // Examine the 2FA page
  const allInputs = await page.locator('input, select, textarea, button').all();
  for (const el of allInputs) {
    const tag = await el.evaluate(e => e.tagName);
    const type = await el.getAttribute('type').catch(() => '');
    const name = await el.getAttribute('name').catch(() => '');
    const id = await el.getAttribute('id').catch(() => '');
    const placeholder = await el.getAttribute('placeholder').catch(() => '');
    const text = await el.innerText().catch(() => '');
    const visible = await el.isVisible().catch(() => false);
    if (visible && (text || id || name || placeholder)) {
      console.log(`Element: ${tag} type=${type} name=${name} id=${id} placeholder=${placeholder} text="${text.substring(0, 50)}" visible=${visible}`);
    }
  }

  // Look for "use another method" link
  try {
    const anotherMethod = page.locator('text=use another method');
    if (await anotherMethod.isVisible({ timeout: 3000 })) {
      console.log('Found "use another method" link');
      await anotherMethod.click();
      await page.waitForTimeout(3000);
      
      // Check what methods are available
      const bodyText = await page.innerText('body').catch(() => '');
      console.log('After clicking another method (first 1000):', bodyText.substring(0, 1000));
    }
  } catch(e) {
    console.log('No "use another method" link found');
  }

  await page.screenshot({ path: '/tmp/porkbun_2fa.png' });

  await browser.close();
})();
