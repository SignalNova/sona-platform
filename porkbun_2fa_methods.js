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

  // Login flow
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

  // Click Login
  const loginBtn = page.locator('button:has-text("Login")').first();
  await loginBtn.click();
  await page.waitForTimeout(8000);
  
  console.log('After login click, URL:', page.url());

  // Now on 2FA page - let's look for "use another method" and all available options
  const bodyText = await page.innerText('body').catch(() => '');
  
  // Find "use another method" link
  const useAnotherMethod = page.locator('a:has-text("use another method"), button:has-text("use another method")').first();
  if (await useAnotherMethod.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Found "use another method" - clicking it');
    await useAnotherMethod.click();
    await page.waitForTimeout(3000);
    
    const bodyText2 = await page.innerText('body').catch(() => '');
    console.log('After clicking another method (first 2000):', bodyText2.substring(0, 2000));
    
    // Look for available methods
    const methods = await page.locator('button, a').all();
    for (const method of methods) {
      const text = await method.innerText().catch(() => '');
      const visible = await method.isVisible().catch(() => false);
      if (visible && text.length > 2 && text.length < 100) {
        console.log('Available method:', text);
      }
    }
  } else {
    console.log('No "use another method" visible');
  }

  // Let's also check what the page actually shows
  // Look for all text on the 2FA section
  const allText = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const texts = [];
    for (const el of elements) {
      if (el.children.length === 0 && el.textContent.trim()) {
        texts.push(el.textContent.trim());
      }
    }
    return texts.filter(t => t.length > 2 && t.length < 200);
  });
  console.log('All text elements:', allText);

  await page.screenshot({ path: '/tmp/porkbun_2fa_methods.png' });

  await browser.close();
})();
