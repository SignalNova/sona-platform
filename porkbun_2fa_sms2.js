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
  await new Promise(r => setTimeout(r, 5000));

  // Accept cookies
  try {
    const acceptBtn = page.locator('button:has-text("Accept All")');
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await new Promise(r => setTimeout(r, 1000));
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
    await new Promise(r => setTimeout(r, 15000));
  }

  // Click Login
  await page.locator('button:has-text("Login")').first().click();
  await new Promise(r => setTimeout(r, 8000));

  // Force-click the SMS button via JavaScript
  const smsClickResult = await page.evaluate(() => {
    // Find the SMS button
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('send SMS code')) {
        btn.click();
        return 'clicked SMS button';
      }
    }
    return 'SMS button not found';
  });
  console.log('SMS button click result:', smsClickResult);
  await new Promise(r => setTimeout(r, 5000));
  
  // Also try to find and click "use another method" 
  const anotherMethodClickResult = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (el.textContent?.trim() === 'use another method' && el.children.length === 0) {
        el.click();
        return 'clicked: ' + el.tagName + '.' + el.className;
      }
    }
    return 'not found as direct text';
  });
  console.log('Another method click result:', anotherMethodClickResult);
  await new Promise(r => setTimeout(r, 3000));

  // Check the page state
  const bodyText = await page.innerText('body').catch(() => '');
  console.log('Current page state (first 1500):', bodyText.substring(0, 1500));

  // Now try to find the SMS-related input
  const smsInput = page.locator('#twoFactorLoginCodePhone, input[placeholder="SMS code"]');
  if (await smsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('SMS input is visible!');
  } else {
    console.log('SMS input not visible');
  }

  // Let me check all visible inputs again
  const allInputs = await page.locator('input').all();
  for (const inp of allInputs) {
    const id = await inp.getAttribute('id').catch(() => '');
    const type = await inp.getAttribute('type').catch(() => '');
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const visible = await inp.isVisible().catch(() => false);
    if (visible && type !== 'hidden') {
      console.log(`Visible input: id=${id} type=${type} placeholder=${placeholder}`);
    }
  }

  await page.screenshot({ path: '/tmp/porkbun_2fa_sms2.png' });
  await browser.close();
})();
